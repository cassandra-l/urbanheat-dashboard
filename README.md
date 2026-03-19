# Melbourne Urban Heat & Vulnerability Dashboard 🌡️🍃
An interactive spatial analysis and web dashboard designed to visualize the Urban Heat Index (UHI) and Heat Vulnerability Index (HVI) across Melbourne's Local Government Areas (LGAs). This project integrates satellite climate data, OpenStreetMap spatial features, and ABS Census demographics to identify high-risk urban areas.

## [Live Dashboard Link]- https://cassandra-l.github.io/urbanheat-dashboard/
<img width="1444" height="785" alt="image" src="https://github.com/user-attachments/assets/868ad601-221b-4cf7-995f-cc2dc29d6550" />

# How to Run Locally
1. Run the Analysis: Open UHI_analysis.R in RStudio. Ensure all raw data files are in the data/ folder. Running the script will generate an updated lga_dashboard.geojson.
2. Launch the Dashboard: Open index.html in a web browser.

# Methodology & Analysis
The core of this project is the R Analysis Pipeline, which performs three tasks:
1. Spatial Feature Engineering
Using the osmdata library, building footprints and green space polygons (parks, forests, grass) are scraped from OpenStreetMap. This allowed for the calculation of Building Density: Ratio of built-up area to total LGA area and Green Coverage: Aggregated non-overlapping vegetation area.

2. Geographically Weighted Regression (GWR)
To understand the Vegetation Cooling Effect seen in the dashboard charts, a GWR model is utilised. This recognizes that the cooling power of vegetation isn't constant as it varies based on vegetation types.

3. Heat Vulnerability Index (HVI) Calculation
The HVI is a custom composite metric calculated as follows:
$$HVI = \frac{1}{3} \times \left( \text{Exposure} + \text{Sensitivity} - \text{Adaptive Capacity} \right)$$
where,
- Exposure: Normalized Urban Heat Index
- Sensitivity: A composite of Building Density, Tree Coverage, and Population demographics (Children $0-4$ and Elderly $65+$).
- Adaptive Capacity: Socioeconomic advantage measured via the IRSD (Index of Relative Socio-economic Disadvantage).

## 📊 Data Sources & Availability

To run the `UHI_analysis.R` script, you must manually download the following datasets. Due to file size and licensing, these are not included in the GitHub repository.

# Required Datasets
| File Name | Description | Source & Download Link |
| :--- | :--- | :--- |
| **LGA_2024_AUST_GDA2020.shp** | 2024 LGA Boundaries | [ABS Digital Boundary Files](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files) (Under *Non-ABS Structure* > *Local Government Areas*) |
| **LGA_socioeconomic.xlsx** | SEIFA 2021 Indices | [ABS SEIFA 2021](https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021) (Data Downloads > *LGA, Indexes, SEIFA 2021.xlsx*) |
| **population.xlsx** | 2023 Pop Estimates | [ABS Population Estimates](https://www.abs.gov.au/statistics/people/population/regional-population-age-and-sex/latest-release) (Search for *LGA 2023 Data Cube*) |
| **HY_WATER_AREA_POLYGON.shp**| Vic Water Bodies | [VicMap Hydro](https://datashare.maps.vic.gov.au/search?md=3984e659-2487-512d-b390-0de817979f21) |
| **urban_heat.shp** | 2018 Urban Heat Index | [Data.Vic - UHI Index](https://datashare.maps.vic.gov.au/search?md=ea69bd5e-3682-5326-b1ec-8e2964baa6a0) |
