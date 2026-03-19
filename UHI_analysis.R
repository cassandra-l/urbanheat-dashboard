# --- IMPORT LIBRARIES ---
library(sf)
library(ggplot2)
library(osmdata)
library(dplyr)
library(readxl)
library(stringr)
library(mgcv)
library(spgwr)

# --- LGA DATA LOADING AND CLEANING ---
# Load LGA Boundaries and Reference List
LGA_data <- st_read("LGA_2024_AUST_GDA2020.shp")
LGA_melb <- read_excel("reference_list/LGA_melb.xlsx", skip = 1)

# Standardize LGA Names
LGA_data <- LGA_data %>%
  mutate(LGA_NAME = str_trim(str_replace_all(LGA_NAME24, "\\(Vic\\.\\)", ""))) %>%
  filter(STE_NAME21 == "Victoria",
         tolower(LGA_NAME) %in% tolower(LGA_melb$`Local Government Area (LGA)`)) %>%
  st_transform(3857) %>%
  mutate(Area_m2 = as.numeric(st_area(geometry))) %>%
  dplyr::select(LGA_NAME, Area_m2)

# --- OSM SCRAPING: BUILDINGS & GREENERY DATA ---
# Initialize columns to store results
LGA_data$building_area_m2 <- 0
LGA_data$green_area_m2 <- 0

for (i in seq_len(nrow(LGA_data))) {
  LGA_geom_3857 <- LGA_data[i, ]
  bbox <- st_bbox(st_transform(LGA_geom_3857, 4326))
  
  # Buildings
  try({
    osm_b <- opq(bbox = bbox) %>% add_osm_feature(key = "building") %>% osmdata_sf()
    if (!is.null(osm_b$osm_polygons) && nrow(osm_b$osm_polygons) > 0) {
      b_intersect <- st_intersection(st_transform(osm_b$osm_polygons, 3857), LGA_geom_3857)
      LGA_data$building_area_m2[i] <- as.numeric(sum(st_area(b_intersect)))
    }
  }, silent = TRUE)
  
  # Vegetation
  try({
    grass <- opq(bbox) %>% add_osm_feature("landuse", "grass") %>% osmdata_sf()
    park  <- opq(bbox) %>% add_osm_feature("leisure", "park") %>% osmdata_sf()
    wood  <- opq(bbox) %>% add_osm_feature("natural", "wood") %>% osmdata_sf()
    forest <- opq(bbox) %>% add_osm_feature("natural", "forest") %>% osmdata_sf()
    
    greens <- bind_rows(grass$osm_polygons, park$osm_polygons, wood$osm_polygons, forest$osm_polygons) %>%
      st_make_valid() %>% st_union()
    
    g_intersect <- st_intersection(st_transform(greens, 3857), LGA_geom_3857)
    LGA_data$green_area_m2[i] <- as.numeric(sum(st_area(g_intersect)))
  }, silent = TRUE)
}

# Calculate building and greenery density
LGA_data <- LGA_data %>%
  mutate(building_density = building_area_m2 / Area_m2,
         green_density = green_area_m2 / Area_m2)

#  --- WATER DATA ---
# Read Data
water_data <- st_read("HY_WATER_AREA_POLYGON.shp") %>% st_transform(3857)

LGA_data$water_area_m2 <- sapply(st_geometry(LGA_data), function(x) {
  intersect <- tryCatch(st_intersection(water_data, x), error = function(e) NULL)
  if(!is.null(intersect) && nrow(intersect) > 0) as.numeric(sum(st_area(intersect))) else 0
})
LGA_data <- LGA_data %>% mutate(water_density = water_area_m2 / Area_m2)

# --- SOCIOECONOMIC DATA ---
# Define Min Max Scale Function
min_max_scale <- function(x) (x - min(x, na.rm = TRUE)) / (max(x, na.rm = TRUE) - min(x, na.rm = TRUE))

# Read and Process Socioeconomic Data
LGA_socio <- read_excel("LGA_socioeconomic.xlsx", sheet = "Table 1", skip = 5) %>%
  rename(LGA_NAME = 2, IRSD_Index = 3, IER_Index = 7) %>%
  mutate(LGA_NAME = str_replace_all(LGA_NAME, "Moreland", "Merri-bek"),
         LGA_NAME = str_replace_all(LGA_NAME, " \\(Vic\\.\\)", "")) %>%
  filter(LGA_NAME %in% LGA_melb$`Local Government Area (LGA)`) %>%
  mutate(IRSD_norm = min_max_scale(IRSD_Index), IER_norm = min_max_scale(IER_Index)) %>%
  dplyr::select(LGA_NAME, IRSD_Index, IER_Index, IRSD_norm, IER_norm)

# --- URBAN HEAT INDEX (UHI) ---
# Read and Process UHI data
UHI_LGA <- st_read("urban_heat.shp") %>%
  mutate(LGA = str_replace_all(LGA, "\\s*\\(.*?\\)", ""),
         LGA = str_replace_all(LGA, "Moreland", "Merri-bek"),
         area_m2 = as.numeric(st_area(geometry))) %>%
  filter(LGA %in% LGA_melb$`Local Government Area (LGA)`) %>%
  group_by(LGA) %>%
  summarise(across(c(UHI18_M, PERANYTREE, PERANYVEG, PERGRASS, PERSHRUB, PERTR03_10, PERTR10_15, PERTR15PL), 
                   ~weighted.mean(.x, area_m2, na.rm = TRUE)))

# --- Population Data ---
# Read and Process Population data
LGA_pop <- read_excel("population.xlsx", sheet = "Table 3", skip = 6) %>%
  filter(`S/T name` == "Victoria") %>%
  mutate(`LGA name` = str_replace_all(`LGA name`, " \\(Vic\\.\\)", "")) %>%
  filter(`LGA name` %in% LGA_melb$`Local Government Area (LGA)`) %>%
  mutate(Elderly = rowSums(across(c(`65-69`,`70-74`, `75-79`, `80-84`, `85 and over`)))) %>%
  mutate(Young_child_norm = min_max_scale(`0-4`), 
         Elderly_norm = min_max_scale(Elderly), 
         Total_norm = min_max_scale(`Total persons`))

# --- JOIN DATASETS ---

LGA_profile <- LGA_data %>%
  left_join(LGA_socio, by = "LGA_NAME") %>%
  left_join(st_drop_geometry(UHI_LGA), by = c("LGA_NAME" = "LGA")) %>%
  left_join(LGA_pop, by = c("LGA_NAME" = "LGA name")) %>%
  mutate(building_norm = min_max_scale(building_density),
         green_norm = min_max_scale(green_density),
         UHI_norm = min_max_scale(UHI18_M))

# --- CALCULATE HEAT VULNERABILITY INDEX (HVI) ---
LGA_profile <- LGA_profile %>%
  mutate(HVI = (1/3) * (
    UHI_norm + 
      (building_norm + PERTR03_10 + Total_norm + Elderly_norm + Young_child_norm) / 5 - 
      (IRSD_norm + IER_norm) / 2
  )) %>%
  mutate(HVI_category = ntile(HVI, 5))

# --- RENAMING GREENERY DATA COLUMNS AND CLASSIFY UHI AND HVI --- 
LGA_profile <- LGA_profile %>%
  rename(
    `Urban Heat Index` = UHI18_M,
    `Grass Coverage` = PERGRASS,
    `Shrub Coverage` = PERSHRUB,
    `Tree (3–10m) Coverage` = PERTR03_10,
    `Tree (10–15m) Coverage` = PERTR10_15,
    `Tree (15m+) Coverage` = PERTR15PL,
    `Total Vegetation Coverage` = PERANYVEG,
    `Total Tree Coverage` = PERANYTREE
  ) %>%
  mutate(
    UHI_class = case_when(
      `Urban Heat Index` >= 8   ~ "Very High",
      `Urban Heat Index` >= 6   ~ "High",
      `Urban Heat Index` >= 4.5 ~ "Moderate",
      TRUE                      ~ "Low"
    ),
    HVI_class = case_when(
      HVI_category %in% c(1, 2) ~ "Low Risk",
      HVI_category == 3         ~ "Moderate Risk",
      TRUE                      ~ "High Risk"
    ),
    IRSD_Category = case_when(
      IRSD_Index >= 1100 ~ "Very Advantaged",
      IRSD_Index >= 1050 ~ "Advantaged",
      IRSD_Index >= 1000 ~ "Average",
      IRSD_Index >= 950  ~ "Disadvantaged",
      TRUE               ~ "Very Disadvantaged"
    )
  )

# --- EXPORT FOR WEB ---
st_write(st_transform(LGA_profile, 4326), "lga_dashboard.geojson", delete_dsn = TRUE)

