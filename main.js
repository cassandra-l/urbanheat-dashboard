// === Initialize Leaflet map ===
const DEFAULT_CENTER = [-37.9, 145.3];
const DEFAULT_ZOOM = 9;
const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

// Adds the OpenStreetMap tile layer to the map
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// === Global state ===
// Define global variables to hold the loaded data
let mapData, geojsonLayer;
// Default data mode
let currentMode = "uhi";
let highlightedLayer = null;

// === Colour category for UHI Map ===
function getUHIColor(value) {
  if (value === undefined || isNaN(value)) return "#cccccc";
  return value >= 8
    ? "#b2182b"
    : value >= 7
    ? "#ef8a62"
    : value >= 6
    ? "#fddbc7"
    : value >= 5
    ? "#d1e5f0"
    : "#2166ac";
}

// === Colour Category for HVI Map ===
function getHVIColor(value) {
  if (value === undefined || isNaN(value)) return "#cccccc";
  return value >= 0.8
    ? "#a50026"
    : value >= 0.6
    ? "#f46d43"
    : value >= 0.4
    ? "#fdae61"
    : "#fee08b";
}

// === Link data to map ===
function drawMap(data, mode = "uhi") {
  // Removes any existing GeoJSON layer from the map before drawing a new one
  if (geojsonLayer) map.removeLayer(geojsonLayer);
  currentMode = mode;

  geojsonLayer = L.geoJSON(data, {
    style: (feature) => {
      // Determines the value based on the current data mode
      const val =
        mode === "uhi" ? feature.properties.UHI : feature.properties.HVI;
      // Selects the relevant color scale based current data mode
      const fillColor = mode === "uhi" ? getUHIColor(val) : getHVIColor(val);
      return {
        fillColor,
        // border colour
        color: "white",
        weight: 1,
        fillOpacity: 0.8,
      };
    },

    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      // Tooltip on hover
      const tooltip = `
        <strong>${p.LGA_NAME}</strong><br/>
        UHI: ${p.UHI?.toFixed(2) ?? "N/A"}<br/>
        HVI: ${p.HVI?.toFixed(2) ?? "N/A"}<br/>
        Risk: ${p.HVI_class ?? "--"}
      `;
      // Binds the tooltip to the map layer
      layer.bindTooltip(tooltip);

      layer.on("click", () => {
        // Checks if the selected layer is already highlighted
        const isSame =
          highlightedLayer &&
          highlightedLayer.feature.properties.LGA_NAME === p.LGA_NAME;

        // If same LGA is clicked: deselects, else: selects new LGA
        highlightedLayer = isSame ? null : layer;

        // Updates the LGA selection dropdown to reflect the selected LGA
        const lgaSelector = document.getElementById("lga-selector");
        if (lgaSelector) {
          lgaSelector.value = highlightedLayer ? p.LGA_NAME : "";
        }

        // If an LGA is selected
        if (highlightedLayer) {
          // Zooms the map to the bounds of the LGA
          map.fitBounds(highlightedLayer.getBounds());

          // Updates the current view label to show the selected LGA and current data mode
          const modeLabel =
            currentMode === "uhi" ? "Urban Heat" : "Heat Vulnerability";
          document.getElementById(
            "view-label"
          ).textContent = `${p.LGA_NAME} – ${modeLabel}`;

          // Updates the summary box to show LGA related details
          updateLgaSummary(p);

          // Hides the global UHI chart and shows LGA related charts
          document.getElementById("uhi-chart-container").style.display = "none";
          document.getElementById("cooling-chart-container").style.display =
            "block";
          // Shows pie charts side by side
          document.getElementById("pie-chart-row").style.display = "flex";

          // Update LGA related charts if they exist
          if (typeof updateCoolingBarChart === "function") {
            updateCoolingBarChart(p.LGA_NAME);
          }
          if (typeof updateLandcoverPieChart === "function") {
            updateLandcoverPieChart(p.LGA_NAME);
          }
          if (typeof updatePopulationPieChart === "function") {
            updatePopulationPieChart(p.LGA_NAME);
          }
        } else {
          // If no LGA is selected, resets map to default
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
          // Updates the view label for the global view
          const globalLabel =
            currentMode === "uhi"
              ? "Metropolitan Melbourne Urban Heat"
              : "Metropolitan Melbourne Heat Vulnerability";
          document.getElementById("view-label").textContent = globalLabel;
          // Updates the summary box to show global summary
          updateGlobalSummary(mapData);

          // Ensures the map size is correctly recalculated after DOM changes
          setTimeout(() => map.invalidateSize(), 100);

          // Shows the global UHI chart and hides LGA related charts
          document.getElementById("uhi-chart-container").style.display =
            "block";
          document.getElementById("cooling-chart-container").style.display =
            "none";
          document.getElementById("pie-chart-row").style.display = "none";

          // Redraws the global UHI bar chart
          drawUhiBarChart(mapData);
        }
      });
    },
  });
  // Adds the styled GeoJSON layer to the map
  geojsonLayer.addTo(map);
  // Updates the map legend based on the current mode
  updateLegend(mode);
  // Applies any active risk filters
  applyFilters();
}

// === Apply Risk Filters ===
// Filters the visibility of LGA based on selected risk categories
function applyFilters() {
  if (!geojsonLayer) return;
  // Gets the data of all selected risk categories
  const selected = Array.from(
    document.querySelectorAll(".risk-filter:checked")
  ).map((el) => el.value);

  // Iterates over each LGA layer on the map
  geojsonLayer.eachLayer((layer) => {
    // Gets the LGA risk class
    const risk = layer.feature.properties.HVI_class || "";
    // Check if the LGA risk class matches the selected filter
    const match = selected.length === 0 || selected.includes(risk);
    // 0.8 visibility f matches filter (selected), 0.3
    layer.setStyle({ opacity: 1, fillOpacity: match ? 0.8 : 0.3 });
  });
}

// === Update the Legend ===
// Updates the map legend based on the current data mode
function updateLegend(mode) {
  const legend = document.getElementById("legend");
  if (!legend) return;
  legend.innerHTML = "";

  // Legend label and colour items (label and color) of UHI and HVI
  const items =
    mode === "uhi"
      ? [
          { label: "≥ 8", color: "#b2182b" },
          { label: "7 ~ 7.9", color: "#ef8a62" },
          { label: "6 ~ 6.9", color: "#fddbc7" },
          { label: "5 ~ 5.9", color: "#d1e5f0" },
          { label: "< 5", color: "#2166ac" },
        ]
      : [
          { label: "≥ 0.8", color: "#a50026" },
          { label: "0.6 ~ 0.79", color: "#f46d43" },
          { label: "0.4 ~ 0.59", color: "#fdae61" },
          { label: "< 0.4", color: "#fee08b" },
        ];

  // Map legend title
  const title = document.createElement("strong");
  title.textContent =
    mode === "uhi"
      ? "Urban Heat Index (UHI) Legend"
      : "Heat Vulnerability Index (HVI) Legend";
  legend.appendChild(title);

  // Creates a container for legend rows
  const itemContainer = document.createElement("div");
  itemContainer.className = "legend-items";
  legend.appendChild(itemContainer);

  items.forEach(({ label, color }) => {
    const div = document.createElement("div");
    div.className = "legend-row";
    div.innerHTML = `<span style="background:${color}"></span><span>${label}</span>`;
    itemContainer.appendChild(div);
  });
}

// === LGA Dropdown ===
// Create a LGA dropdown with LGA names from data
function populateLGASelector(data) {
  const selector = document.getElementById("lga-selector");
  const label = document.getElementById("view-label");
  if (!selector || !label) return;

  // Sorts LGA name alphabetically
  const lgaNames = [
    ...new Set(data.features.map((f) => f.properties.LGA_NAME)),
  ].sort();

  // Adds a default "Global View" option to the menu
  selector.innerHTML = `<option value="">-- Global View --</option>`;
  // Populates the dropdown with options for each LGA.
  lgaNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selector.appendChild(opt);
  });

  // Event listener to the menu
  selector.addEventListener("change", (e) => {
    // Get the selected LGA name.
    const selectedLGA = e.target.value;
    // Create a varibale to store the layer of the selected LGA
    let matchedLayer = null;

    geojsonLayer.eachLayer((layer) => {
      // If no LGA is selected, all layers are visible
      // Or only the selected LGA is fully opaque and others are faded
      const isMatch =
        !selectedLGA || layer.feature.properties.LGA_NAME === selectedLGA;
      layer.setStyle({ opacity: 1, fillOpacity: isMatch ? 0.8 : 0.3 });
      if (selectedLGA && isMatch) matchedLayer = layer;
    });

    // Data mode label
    const modeName =
      currentMode === "uhi" ? "Urban Heat" : "Heat Vulnerability";

    // If a specific LGA is selected
    if (selectedLGA && matchedLayer) {
      // Updates the view label
      label.textContent = `${selectedLGA} – ${modeName}`;
      // Zooms the map to the selected LGA
      map.fitBounds(matchedLayer.getBounds());
      // Updates the summary box to show LGA related data
      updateLgaSummary(matchedLayer.feature.properties);

      // Hides the global UHI chart and shows LGA related charts
      document.getElementById("uhi-chart-container").style.display = "none";
      document.getElementById("cooling-chart-container").style.display =
        "block";
      // Shows pie charts side by side
      document.getElementById("pie-chart-row").style.display = "flex";

      // Calls functions to update LGA related charts
      if (typeof updateCoolingBarChart === "function") {
        updateCoolingBarChart(selectedLGA);
      }

      if (typeof updateLandcoverPieChart === "function") {
        updateLandcoverPieChart(selectedLGA);
      }

      if (typeof updatePopulationPieChart === "function") {
        updatePopulationPieChart(selectedLGA);
      }

      // Ensures the map bounds and size are correctly updated after DOM changes
      requestAnimationFrame(() => {
        map.fitBounds(matchedLayer.getBounds());
        map.invalidateSize();
      });
    } else {
      // If "Global View" is selected, updates the view label
      label.textContent = `Metropolitan Melbourne ${modeName}`;
      // Resets map to default view
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      // Updates the summary box to show global summary
      updateGlobalSummary(mapData);

      // Shows the global UHI chart and hides LGA related charts
      document.getElementById("uhi-chart-container").style.display = "block";
      document.getElementById("cooling-chart-container").style.display = "none";
      document.getElementById("pie-chart-row").style.display = "none";

      drawUhiBarChart(mapData);
    }
  });
}

// === Draw Bar Chart ===
// Draws a number of LGA in each UHI categories bar chart
function drawUhiBarChart(data) {
  const svg = d3.select("#uhi-bar-chart");
  svg.selectAll("*").remove();

  // Colors for each UHI category
  const uhiColors = {
    "≥ 8": "#b2182b",
    "7 ~ 7.9": "#ef8a62",
    "6 ~ 6.9": "#fddbc7",
    "5 ~ 5.9": "#d1e5f0",
    "< 5": "#2166ac",
  };

  // UHI categories
  const bands = {
    "≥ 8": (d) => d.UHI >= 8,
    "7 ~ 7.9": (d) => d.UHI >= 7 && d.UHI < 8,
    "6 ~ 6.9": (d) => d.UHI >= 6 && d.UHI < 7,
    "5 ~ 5.9": (d) => d.UHI >= 5 && d.UHI < 6,
    "< 5": (d) => d.UHI < 5,
  };

  // Calculates the number of LGA in each UHI category
  const counts = Object.entries(bands).map(([label, test]) => ({
    label,
    count: data.features.filter((f) => test(f.properties)).length,
  }));

  // Gets the dimensions of the parent container to make the chart responsive
  const container = svg.node().parentNode;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Defines chart size
  const margin = { top: 30, right: 40, bottom: 40, left: 40 };
  const chartWidth = containerWidth - margin.left - margin.right;
  // Remaining height for bars
  const chartHeight = containerHeight - margin.top - margin.bottom;

  // Bar height and gaps between bars
  const barHeight = 40;
  const barGap = 20;
  // Calculate total height needed for bars and gaps
  const totalBarsHeight = counts.length * (barHeight + barGap);

  svg
    .attr("width", containerWidth)
    .attr("height", totalBarsHeight + margin.top + margin.bottom);

  // Defines x-axis
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(counts, (d) => d.count)])
    .range([0, chartWidth]);

  // Defines y-axis
  const y = d3
    .scaleBand()
    // Domain = UHI categories label
    .domain(counts.map((d) => d.label))
    // Range = total height of the bars
    .range([0, totalBarsHeight])
    .paddingOuter(0.2)
    .paddingInner(barGap / barHeight);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Adds the Y-axis
  g.append("g").call(d3.axisLeft(y).tickSize(0)).style("font-size", "11px");

  // Adds the X-axis
  g.append("g")
    .attr("transform", `translate(0,${totalBarsHeight})`) // Positions X-axis at the bottom.
    .call(d3.axisBottom(x).ticks(5)); // Draws X-axis with 5 ticks.

  // Draws the bars for each UHI categories
  g.selectAll("rect")
    .data(counts)
    .enter()
    .append("rect")
    .attr("y", (d) => y(d.label))
    .attr("x", 0)
    .attr("height", y.bandwidth())
    .attr("width", (d) => x(d.count))
    .attr("fill", (d) => uhiColors[d.label]);
}

// === Event Listeners ===
// For interactive elements

// Event listener to all risk filter checkboxes to apply filters
document.querySelectorAll(".risk-filter").forEach((el) => {
  el.addEventListener("change", applyFilters);
});

// Event listener to the data mode selector
const modeSelector = document.getElementById("mode-selector");
if (modeSelector) {
  modeSelector.addEventListener("change", (e) => {
    // Gets the selected mode
    const mode = e.target.value;
    // Updates the global current mode
    currentMode = mode;
    // Redraws the map with the new mode
    drawMap(mapData, mode);
    // Reapply filters
    applyFilters();

    // Updates the current view label and map zoom based on selected LGA and data mode
    const selectedLGA = document.getElementById("lga-selector")?.value;
    const label = document.getElementById("view-label");
    const modeLabel = mode === "uhi" ? "Urban Heat" : "Heat Vulnerability";

    if (selectedLGA) {
      // Highlight the selected LGA in the updated data mode
      geojsonLayer.eachLayer((layer) => {
        const isMatch = layer.feature.properties.LGA_NAME === selectedLGA;
        layer.setStyle({ opacity: 1, fillOpacity: isMatch ? 0.8 : 0.3 });
        if (isMatch) map.fitBounds(layer.getBounds());
      });
      if (label) label.textContent = `${selectedLGA} – ${modeLabel}`;
    } else {
      // Resets map view to default
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      if (label) label.textContent = `Metropolitan Melbourne ${modeLabel}`;
    }
  });
}

// === Vegetation Cooling Effectiveness Barchart ===
function updateCoolingBarChart(lgaName) {
  const lgaFeature = mapData.features.find(
    (f) => f.properties.LGA_NAME === lgaName
  );
  if (!lgaFeature) return;

  const p = lgaFeature.properties;

  // Data for barchart
  const data = [
    { label: "Grass", value: p["Grass"] },
    { label: "Shrub", value: p["Shrub"] },
    { label: "Tree (3–10m)", value: p["Tree..3.10m."] },
    { label: "Tree (10–15m)", value: p["Tree..10.15m."] },
    { label: "Tree (15m+)", value: p["Tree..15m.."] },
  ];

  const svg = d3.select("#cooling-bar-chart");
  svg.selectAll("*").remove();

  // Defines chart size
  const margin = { top: 20, right: 30, bottom: 30, left: 85 };
  // Calculates chart width based on parent container
  const width = svg.node().parentNode.clientWidth - margin.left - margin.right;
  // Calculates chart height based on number of data items
  const height = data.length * 40;

  svg
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  // Determines the min adn max values for the x-axis domain so barchart can center around zero
  const minValue = d3.min(data, (d) => d.value);
  const maxValue = d3.max(data, (d) => d.value);
  const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));

  // x-axis
  const x = d3.scaleLinear().domain([-absMax, absMax]).range([0, width]);

  // y-axis
  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.label))
    .range([0, height])
    .padding(0.2);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Adds y-axis
  g.append("g")
    .call(d3.axisLeft(y).tickSize(0))
    .style("font-size", "12px")
    .selectAll("text")
    .attr("fill", "#e0e0e0");

  // Adds x-axis
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll("text")
    .attr("fill", "#e0e0e0");

  // Adds vertical line at x=0 (cuz data has positive and negative)
  g.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", 1);

  // Creates the bars
  g.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("y", (d) => y(d.label))
    .attr("x", (d) => x(Math.min(0, d.value)))
    .attr("width", (d) => Math.abs(x(d.value) - x(0)))
    .attr("height", y.bandwidth())
    .attr("fill", "#69b3a2");
}

// === LandCover Pie Chart ===
// Draws a pie chart of land cover composition
function updateLandcoverPieChart(lgaName) {
  // Gets relevant data from dataset
  const lga = mapData.features.find((f) => f.properties.LGA_NAME === lgaName);
  if (!lga) return;

  const p = lga.properties;
  // Calculates 'Other' land cover percentage.
  const other = 1 - (p.building_density + p.green_density + p.water_density);

  const data = [
    { label: "Buildings", value: p.building_density, color: "#FCF5EF" },
    { label: "Vegetation", value: p.green_density, color: "#69B3A2" },
    { label: "Water", value: p.water_density, color: "#4292C6" },
    { label: "Other", value: other, color: "#BDCDD6" },
  ];

  const svg = d3.select("#landcover-pie-chart");
  svg.selectAll("*").remove();

  // Gets the dimensions of the parent container
  const container = svg.node().parentNode;
  const width = container.clientWidth;
  const height = container.clientHeight;
  // Reserve space for the legend
  const legendReserveHeight = 70;
  // Calculates remaining height for the pie chart
  const pieChartHeight = height - legendReserveHeight;
  const radius = Math.min(width, pieChartHeight) / 2 - 10;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  // Pie
  const pie = d3.pie().value((d) => d.value);
  // Pie slices
  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  // Creates the slices of the pie chart
  const arcs = g.selectAll("arc").data(pie(data)).enter().append("g");

  arcs
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => d.data.color)
    .on("mouseover", function (event, d) {
      // Shows tooltip when hover
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.data.label}</strong><br/>${(d.data.value * 100).toFixed(
            1
          )}%`
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    // Hides tooltip
    .on("mouseout", () => tooltip.style("opacity", 0));

  // === Land Cover Legend ===
  const legendGroup = svg
    .append("g")
    .attr("class", "legend")
    // Legend positiion
    .attr("transform", `translate(10, 17)`);

  const legendItemSpacing = 20;
  const legendColorBoxSize = 12;

  const legendItems = legendGroup
    .selectAll(".legend-item")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * legendItemSpacing})`);

  legendItems
    .append("rect")
    .attr("width", legendColorBoxSize)
    .attr("height", legendColorBoxSize)
    .attr("fill", (d) => d.color);

  legendItems
    .append("text")
    .attr("x", legendColorBoxSize + 8)
    .attr("y", legendColorBoxSize / 2)
    .text((d) => d.label)
    .attr("font-size", "12px")
    .attr("alignment-baseline", "middle")
    .attr("fill", "#e0e0e0");

  // Tooltip
  let tooltip = d3.select("#landcover-tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("id", "landcover-tooltip")
      .style("position", "absolute")
      .style("text-align", "center")
      .style("padding", "6px 8px")
      .style("font-size", "12px")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");
  }
}

// === Population Pie Chart ===

function updatePopulationPieChart(lgaName) {
  // Gets relevant data
  const lga = mapData.features.find((f) => f.properties.LGA_NAME === lgaName);
  if (!lga) return;

  const p = lga.properties;
  const data = [
    { label: "Children (0–4)", value: p.Child_pct, color: "#F46D43" },
    { label: "Elderly (65+)", value: p.Elderly_pct, color: "#A50026" },
    { label: "Other", value: p.Other_pct, color: "#BDCDD6" },
  ];

  const svg = d3.select("#population-pie-chart");
  svg.selectAll("*").remove();

  const container = svg.node().parentNode;
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Reserve space for the legend
  const legendReserveHeight = 70;
  const pieChartHeight = height - legendReserveHeight;
  const radius = Math.min(width, pieChartHeight) / 2 - 10;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  // Pie
  const pie = d3.pie().value((d) => d.value);
  // Slices
  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  // Creates the slices
  const arcs = g.selectAll("arc").data(pie(data)).enter().append("g");

  arcs
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => d.data.color)
    .on("mouseover", function (event, d) {
      // Tooltip on hover
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.data.label}</strong><br/>${(d.data.value * 100).toFixed(
            1
          )}%`
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    // Hides tooltip
    .on("mouseout", () => tooltip.style("opacity", 0));

  // === Population Legend ===
  const legendGroup = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(10, 25)`);

  const legendItemSpacing = 20;
  const legendColorBoxSize = 12;

  const legendItems = legendGroup
    .selectAll(".legend-item")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * legendItemSpacing})`);

  legendItems
    .append("rect")
    .attr("width", legendColorBoxSize)
    .attr("height", legendColorBoxSize)
    .attr("fill", (d) => d.color);

  // Text labels for each legend item
  legendItems
    .append("text")
    .attr("x", legendColorBoxSize + 8)
    .attr("y", legendColorBoxSize / 2)
    .text((d) => d.label)
    .attr("font-size", "12px")
    .attr("alignment-baseline", "middle")
    .attr("fill", "#e0e0e0");

  // Tooltip
  let tooltip = d3.select("#population-tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("id", "population-tooltip")
      .style("position", "absolute")
      .style("text-align", "center")
      .style("padding", "6px 8px")
      .style("font-size", "12px")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");
  }
}

// === Global Summary ===
// Updates the summary box with global summary
function updateGlobalSummary(data) {
  const features = data.features;

  // LGA with the highest UHI
  const topUHI = features.reduce((max, f) =>
    f.properties.UHI > max.properties.UHI ? f : max
  );

  // LGA with the highest HVI
  const topHVI = features.reduce((max, f) =>
    f.properties.HVI > max.properties.HVI ? f : max
  );

  // LGA with the highest risk
  const topRisk = features.reduce((max, f) =>
    f.properties.HVI_category > max.properties.HVI_category ? f : max
  );

  // LGA with the lowest risk
  const leastRisk = features.reduce((min, f) =>
    f.properties.HVI_category > min.properties.HVI_category ? f : min
  );

  const summaryBox = document.getElementById("summary-box");
  // Updates the inner HTML of the summary box with global summary
  summaryBox.innerHTML = `
    <strong>Global Summary:</strong><br/>
    • Highest UHI: <strong>${topUHI.properties.LGA_NAME}</strong><br/>
    • Highest HVI: <strong>${topHVI.properties.LGA_NAME}</strong><br/>
    • Highest Risk: <strong>${topRisk.properties.LGA_NAME}</strong><br/>
    • Lowest Risk: <strong>${leastRisk.properties.LGA_NAME}</strong>
  `;
}

// === LGA specific Summary ===
// Updates the summary box with LGA related summary
function updateLgaSummary(properties) {
  const summaryBox = document.getElementById("summary-box");

  // Updates the inner HTML of the summary box with LGA related summary
  summaryBox.innerHTML = `
    <strong>${properties.LGA_NAME} Summary:</strong><br/>
    • UHI: <strong>${properties.UHI.toFixed(2)}</strong><br/>
    • HVI: <strong>${properties.HVI.toFixed(2)}</strong><br/>
    • Risk Level: <strong>${properties.HVI_class}</strong><br/>
    • Socioeconomic Status (IRSD): <strong>${properties.IRSD_Category} (${
    properties.IRSD_Index
  })</strong>
  `;
}

// === Average UHI ===
// Calculates the average UHI
function computeAverageUHI(data) {
  // Obtains UHI values
  const values = data.features
    .map((f) => f.properties.UHI)
    // Filter NA
    .filter((val) => typeof val === "number" && !isNaN(val));

  // Calculates average
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  return avg;
}

// === Manual ===
document.getElementById("toggle-manual").addEventListener("click", () => {
  const manual = document.getElementById("manual-content");
  manual.style.display = manual.style.display === "none" ? "block" : "none";
});

// === Load GeoJSON and Initialize Everything ===
// Gets the GeoJSON data, initializes global state, and sets up the default dashboard view
d3.json("lga_dashboard.geojson").then((data) => {
  mapData = data;
  // Sets defaut view to UHI
  currentMode = "uhi";

  // Draws the global UHI bar chart.
  drawUhiBarChart(data);
  // LGA dropdown menu
  populateLGASelector(data);
  // Initial map
  drawMap(mapData, currentMode);

  // Calculates and shows the average UHI
  const avgUHI = computeAverageUHI(data);
  document.getElementById("avg-uh").textContent = `${avgUHI.toFixed(1)}°C`;

  // Default current view
  const label = document.getElementById("view-label");
  if (label) label.textContent = "Metropolitan Melbourne Urban Heat";

  // Global summary
  updateGlobalSummary(mapData);
});
