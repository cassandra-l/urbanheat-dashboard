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
