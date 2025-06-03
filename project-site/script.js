// D3 margin convention for charts
const margin = {top: 30, right: 40, bottom: 60, left: 70};

// Helper function to calculate CAGR (kept for stat cards, though main charts use new data)
const calculateCAGR = (startValue, endValue, periods) => {
    if (periods <= 0 || startValue === 0) return 0;
    return (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;
};

// New processData function for the combined 'data.csv'
function processData(rawData) {
    if (!rawData || rawData.length === 0) return [];

    // Filter out any rows that might be empty or contain non-data (e.g., metadata from combined CSV)
    const filteredData = rawData.filter(d => d.Country && d.Date && d['Amount Spent'] && d['GDP per Capita'] && d['Pharma Spending as % of GDP per Capita']);

    const processed = filteredData.map(d => {
        return {
            date: parseInt(d.Date),
            country: d.Country,
            amountSpent: parseFloat(d['Amount Spent']),
            gdpPerCapita: parseFloat(d['GDP per Capita']),
            pharmaShareGDP: parseFloat(d['Pharma Spending as % of GDP per Capita'])
        };
    }).filter(d => 
        !isNaN(d.date) && 
        !isNaN(d.amountSpent) && 
        !isNaN(d.gdpPerCapita) && 
        !isNaN(d.pharmaShareGDP)
    );

    // Sort data by country and then by date
    processed.sort((a, b) => {
        if (a.country < b.country) return -1;
        if (a.country > b.country) return 1;
        return a.date - b.date;
    });

    return processed;
}

// Calculate and display key statistics
function calculateAndDisplayStats(processedData) {
    if (!processedData || processedData.length === 0) {
        console.error("No data available for statistics calculation");
        d3.select("#aus-avg-spend").text("N/A");
        d3.select("#uk-avg-spend").text("N/A");
        d3.select("#growth-rate-aus").text("N/A");
        d3.select("#growth-rate-uk").text("N/A");
        return;
    }

    const ausData = processedData.filter(d => d.country === 'Australia');
    const ukData = processedData.filter(d => d.country === 'United Kingdom');

    const ausAvg = d3.mean(ausData, d => d.amountSpent)?.toFixed(0) || 'N/A';
    const ukAvg = d3.mean(ukData, d => d.amountSpent)?.toFixed(0) || 'N/A';

    // Ensure there's enough data for CAGR (at least two points)
    const ausCAGR = ausData.length > 1 ? 
        calculateCAGR(ausData[0].amountSpent, ausData[ausData.length - 1].amountSpent, ausData.length - 1)?.toFixed(1) + '%' :
        'N/A';
        
    const ukCAGR = ukData.length > 1 ?
        calculateCAGR(ukData[0].amountSpent, ukData[ukData.length - 1].amountSpent, ukData.length - 1)?.toFixed(1) + '%' :
        'N/A';

    d3.select("#aus-avg-spend").text(`$${ausAvg}`);
    d3.select("#uk-avg-spend").text(`$${ukAvg}`);
    d3.select("#growth-rate-aus").text(ausCAGR);
    d3.select("#growth-rate-uk").text(ukCAGR);
}

// Global variable for storing processed data
let globalPharmaGDPData = [];
let currentSelectedYear = 2010; // Default year for the bar chart
let selectedGroupedYears = []; // For the new grouped bar chart

// --- D3 Chart Drawing Functions ---

// Tooltip setup
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "rgba(0,0,0,0.8)")
    .style("color", "white")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("pointer-events", "none"); // Important for mouse events to pass through

// Color scale for countries
const countryColors = d3.scaleOrdinal()
    .domain(['Australia', 'United Kingdom', 'Canada', 'Germany', 'Sweden', 'United States'])
    .range(['var(--aus-color)', 'var(--uk-color)', '#4CAF50', '#FFC107', '#2196F3', '#9C27B0']); // Custom colors for better distinction

function drawScatterPlot(data) {
    const containerId = "#scatter-plot"; // Renamed from #line-chart in HTML
    d3.select(containerId).html(""); // Clear previous chart

    const containerDiv = d3.select(containerId);
    const containerWidth = containerDiv.node().getBoundingClientRect().width;
    const containerHeight = containerDiv.node().getBoundingClientRect().height;

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = containerDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define scales
    const xScale = d3.scaleLog() // Log scale for GDP per capita as it can vary widely
        .domain(d3.extent(data, d => d.gdpPerCapita))
        .range([0, width])
        .nice();

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.amountSpent))
        .range([height, 0])
        .nice();

    // Draw axes
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(5, "~s")); // Format ticks for large numbers

    const yAxis = svg.append("g")
        .call(d3.axisLeft(yScale));

    // Axis labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("GDP per Capita (PPP converted)");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text("Pharmaceutical Spending per Capita (USD)");

    // Draw circles (dots)
    const circles = svg.selectAll(".dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.gdpPerCapita))
        .attr("cy", d => yScale(d.amountSpent))
        .attr("r", 5)
        .style("fill", d => countryColors(d.country))
        .style("opacity", 0.7)
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                <strong>${d.country}</strong><br/>
                Year: ${d.date}<br/>
                Pharma Spend: $${d.amountSpent.toFixed(0)}<br/>
                GDP per Capita: $${d.gdpPerCapita.toFixed(0)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Add a legend
    const countries = [...new Set(data.map(d => d.country))];
    const legend = svg.selectAll(".legend")
        .data(countries)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(0,${i * 20})`);

    legend.append("rect")
        .attr("x", width - 18)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", countryColors);

    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(d => d);

    // Optional: Time animation (simplified for now, can be expanded with slider)
    // For a simple animation, we can just show the latest year or cycle through
    // For a true motion chart, you'd need a slider and transition logic.
    // Let's just show the current year's data for now.
    // To implement motion, you'd filter data by year and update circles in a loop/transition.
}


function drawBarChart(data, selectedYear) {
    const containerId = "#bar-chart";
    d3.select(containerId).html(""); // Clear previous chart

    const containerDiv = d3.select(containerId);
    const containerWidth = containerDiv.node().getBoundingClientRect().width;
    const containerHeight = containerDiv.node().getBoundingClientRect().height;

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = containerDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const yearData = data.filter(d => d.date === selectedYear);

    // Sort data by Pharma Spending as % of GDP per Capita for better visualization
    yearData.sort((a, b) => b.pharmaShareGDP - a.pharmaShareGDP);

    // Define scales
    const xScale = d3.scaleBand()
        .domain(yearData.map(d => d.country))
        .range([0, width])
        .padding(0.1);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(yearData, d => d.pharmaShareGDP) * 1.1]) // 10% buffer
        .range([height, 0])
        .nice(); // Added .nice() for cleaner tick values

    // Draw axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => d.toFixed(1) + '%')); // Corrected: format as number with % sign

    // Axis labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Country");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text("Pharma Spending as % of GDP per Capita");

    // Draw bars
    svg.selectAll(".bar")
        .data(yearData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.country))
        .attr("y", d => yScale(d.pharmaShareGDP))
        .attr("width", xScale.bandwidth())
        .attr("height", d => height - yScale(d.pharmaShareGDP))
        .style("fill", d => countryColors(d.country))
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                <strong>${d.country}</strong><br/>
                Year: ${d.date}<br/>
                Pharma Share: ${d.pharmaShareGDP.toFixed(2)}%
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}

function drawDifferenceChart(data) {
    const containerId = "#difference-chart";
    d3.select(containerId).html(""); // Clear previous chart

    const containerDiv = d3.select(containerId);
    const containerWidth = containerDiv.node().getBoundingClientRect().width;
    const containerHeight = containerDiv.node().getBoundingClientRect().height;

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = containerDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate difference data
    const differenceData = [];
    const australiaData = data.filter(d => d.country === 'Australia');
    const ukData = data.filter(d => d.country === 'United Kingdom');

    // Merge data based on year
    const merged = d3.merge([australiaData, ukData]);
    const years = [...new Set(merged.map(d => d.date))].sort(d3.ascending);

    years.forEach(year => {
        const aus = australiaData.find(d => d.date === year);
        const uk = ukData.find(d => d.date === year);
        if (aus && uk) {
            differenceData.push({
                year: year,
                difference: aus.amountSpent - uk.amountSpent
            });
        }
    });

    // Define scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(differenceData, d => d.year))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(differenceData, d => d.difference))
        .range([height, 0])
        .nice();

    // Draw axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d"))); // Format as integer year

    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Axis labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Year");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text("Spending Difference (AU - UK) (USD)");

    // Draw zero line
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(0))
        .attr("x2", width)
        .attr("y2", yScale(0))
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4");

    // Draw line
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.difference));

    svg.append("path")
        .datum(differenceData)
        .attr("fill", "none")
        .attr("stroke", "var(--highlight-color)")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Add circles for hover
    svg.selectAll(".diff-dot")
        .data(differenceData)
        .enter().append("circle")
        .attr("class", "diff-dot")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.difference))
        .attr("r", 5)
        .style("fill", "var(--highlight-color)")
        .style("opacity", 0) // Hidden by default
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 1);
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                <strong>Year: ${d.year}</strong><br/>
                Difference: $${d.difference.toFixed(0)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}

function drawGroupedBarChart(data, yearsToDisplay) {
    const containerId = "#grouped-bar-chart";
    d3.select(containerId).html(""); // Clear previous chart

    if (yearsToDisplay.length === 0) {
        d3.select(containerId).html("<p class='text-center text-secondary mt-5'>Select years to compare pharmaceutical spending.</p>");
        return;
    }

    const containerDiv = d3.select(containerId);
    const containerWidth = containerDiv.node().getBoundingClientRect().width;
    const containerHeight = containerDiv.node().getBoundingClientRect().height;

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = containerDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Filter data for Australia and UK and selected years
    const filteredData = data.filter(d => 
        (d.country === 'Australia' || d.country === 'United Kingdom') && 
        yearsToDisplay.includes(d.date)
    );

    // Group data by year
    const dataByYear = Array.from(d3.group(filteredData, d => d.date), ([key, value]) => ({
        year: key,
        countries: value
    }));

    // Sort by year
    dataByYear.sort((a, b) => a.year - b.year);

    // Define scales
    const x0Scale = d3.scaleBand()
        .domain(dataByYear.map(d => d.year))
        .range([0, width])
        .paddingOuter(0.1)
        .paddingInner(0.1);

    const x1Scale = d3.scaleBand()
        .domain(['Australia', 'United Kingdom'])
        .range([0, x0Scale.bandwidth()])
        .padding(0.05);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.amountSpent) * 1.1]) // 10% buffer
        .range([height, 0])
        .nice();

    // Draw axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0Scale).tickFormat(d3.format("d")));

    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Axis labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Year");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text("Pharmaceutical Spending per Capita (USD)");

    // Draw bars
    const yearGroups = svg.selectAll(".year-group")
        .data(dataByYear)
        .enter().append("g")
        .attr("class", "year-group")
        .attr("transform", d => `translate(${x0Scale(d.year)},0)`);

    yearGroups.selectAll(".bar")
        .data(d => d.countries)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x1Scale(d.country))
        .attr("y", d => yScale(d.amountSpent))
        .attr("width", x1Scale.bandwidth())
        .attr("height", d => height - yScale(d.amountSpent))
        .style("fill", d => countryColors(d.country))
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                <strong>${d.country}</strong><br/>
                Year: ${d.date}<br/>
                Pharma Spend: $${d.amountSpent.toFixed(0)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Add a legend for the grouped bar chart
    const groupedLegend = svg.selectAll(".grouped-legend")
        .data(['Australia', 'United Kingdom'])
        .enter().append("g")
        .attr("class", "grouped-legend")
        .attr("transform", (d, i) => `translate(${width - 120},${i * 20})`); // Position to the right

    groupedLegend.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", countryColors);

    groupedLegend.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(d => d);
}


// Main initialization function
function initVisualizations(data) {
    globalPharmaGDPData = data; // Store processed data globally

    // Get unique years for the year selector
    const allYears = [...new Set(data.map(d => d.date))].sort(d3.ascending);
    
    // Populate single year selector for bar chart
    const yearSelector = d3.select("#year-selector");
    if (yearSelector.empty() || yearSelector.selectAll("option").empty()) {
        yearSelector.selectAll("option")
            .data(allYears)
            .enter().append("option")
            .attr("value", d => d)
            .text(d => d);
        
        currentSelectedYear = allYears[allYears.length - 1]; // Default to latest year
        yearSelector.property("value", currentSelectedYear);
    }

    // Populate multi-year selector for grouped bar chart
    const groupedYearSelector = d3.select("#grouped-year-selector");
    if (groupedYearSelector.empty() || groupedYearSelector.selectAll("option").empty()) {
        groupedYearSelector.selectAll("option")
            .data(allYears)
            .enter().append("option")
            .attr("value", d => d)
            .text(d => d);
        
        // Initialize selected years to the first 6 available years
        selectedGroupedYears = allYears.slice(0, Math.min(6, allYears.length));
        groupedYearSelector.selectAll("option")
            .property("selected", d => selectedGroupedYears.includes(d));
    }

    // Draw all charts
    drawScatterPlot(globalPharmaGDPData);
    drawBarChart(globalPharmaGDPData, currentSelectedYear);
    drawDifferenceChart(globalPharmaGDPData);
    drawGroupedBarChart(globalPharmaGDPData, selectedGroupedYears);

    // Update stat cards
    calculateAndDisplayStats(globalPharmaGDPData);

    // Draw raw data table
    drawDataTable(globalPharmaGDPData);
}


// Function to draw the raw data table
function drawDataTable(data) {
    const tableContainer = d3.select("#data-table");
    tableContainer.html(""); // Clear previous table

    if (!data || data.length === 0) {
        tableContainer.html("<p>No data to display in table.</p>");
        return;
    }

    const table = tableContainer.append("table").attr("class", "table table-striped table-hover");
    const thead = table.append("thead");
    const tbody = table.append("tbody");

    // Table Headers
    const headers = ["Date", "Country", "Pharma Spending (USD)", "GDP per Capita (USD)", "Pharma Spending as % of GDP"];
    thead.append("tr")
        .selectAll("th")
        .data(headers)
        .enter().append("th")
        .text(d => d);

    // Table Rows
    const rows = tbody.selectAll("tr")
        .data(data)
        .enter().append("tr");

    rows.selectAll("td")
        .data(d => [
            d.date,
            d.country,
            `$${d.amountSpent.toFixed(0)}`,
            `$${d.gdpPerCapita.toFixed(0)}`,
            `${d.pharmaShareGDP.toFixed(2)}%`
        ])
        .enter().append("td")
        .text(d => d);
}


// Load and process the CSV data
d3.csv("data.csv").then(function(rawData) {
    console.log("Raw CSV data:", rawData);
    
    const processedData = processData(rawData);
    console.log("Processed data:", processedData);
    
    if (processedData.length === 0) {
        console.error("No valid data could be processed");
        d3.select("#data-table").html(`
            <div class="alert alert-warning">
                Data loaded but could not be processed. Please check the CSV format or console for errors.
                <br>First few rows of raw data: <pre>${JSON.stringify(rawData.slice(0, 3), null, 2)}</pre>
            </div>
        `);
        return;
    }
    
    initVisualizations(processedData);

    // Event listener for the single year selector (bar chart)
    d3.select("#year-selector").on("change", function() {
        currentSelectedYear = parseInt(this.value);
        drawBarChart(globalPharmaGDPData, currentSelectedYear);
    });

    // Event listener for the grouped year selector
    d3.select("#grouped-year-selector").on("change", function() {
        const selectedOptions = Array.from(this.selectedOptions).map(option => parseInt(option.value));
        
        // Limit to max 6 years
        if (selectedOptions.length > 6) {
            // If more than 6 are selected, revert to the previous selection or take the first 6
            // For simplicity, let's just take the first 6 if too many are selected.
            selectedGroupedYears = selectedOptions.slice(0, 6);
            // Re-set the dropdown to reflect the limited selection
            d3.select(this).selectAll("option")
                .property("selected", d => selectedGroupedYears.includes(d));
            console.warn("Only up to 6 years can be selected for this chart.");
        } else {
            selectedGroupedYears = selectedOptions;
        }
        drawGroupedBarChart(globalPharmaGDPData, selectedGroupedYears);
    });

    // Event listener for the clear selection button
    d3.select("#clear-grouped-years").on("click", function() {
        selectedGroupedYears = [];
        d3.select("#grouped-year-selector").selectAll("option").property("selected", false);
        drawGroupedBarChart(globalPharmaGDPData, selectedGroupedYears);
    });

    // Event listeners for expand chart buttons
    d3.selectAll(".expand-chart-btn").on("click", function() {
        const chartId = d3.select(this).attr("data-chart-id");
        const chartCard = d3.select(`#${chartId}`).node().closest('.card'); // Get the parent card

        // Toggle fullscreen class on the chart card and body
        chartCard.classList.toggle("fullscreen-chart-card");
        d3.select("body").classed("no-scroll", chartCard.classList.contains("fullscreen-chart-card"));

        // Toggle visibility of the close button
        d3.select(chartCard).select(".close-fullscreen-btn").style("display", chartCard.classList.contains("fullscreen-chart-card") ? "block" : "none");


        // Re-draw the chart to adjust to new dimensions
        if (chartId === "scatter-plot") {
            drawScatterPlot(globalPharmaGDPData);
        } else if (chartId === "bar-chart") {
            drawBarChart(globalPharmaGDPData, currentSelectedYear);
        } else if (chartId === "grouped-bar-chart") {
            drawGroupedBarChart(globalPharmaGDPData, selectedGroupedYears);
        } else if (chartId === "difference-chart") {
            drawDifferenceChart(globalPharmaGDPData);
        }

        // Change button text
        const button = d3.select(this);
        if (chartCard.classList.contains("fullscreen-chart-card")) {
            button.text("Close Fullscreen");
        } else {
            button.text("View Fullscreen");
        }
    });

    // Event listener for the close fullscreen buttons
    d3.selectAll(".close-fullscreen-btn").on("click", function() {
        const chartId = d3.select(this).attr("data-chart-id");
        const chartCard = d3.select(`#${chartId}`).node().closest('.card');

        // Remove fullscreen classes
        chartCard.classList.remove("fullscreen-chart-card");
        d3.select("body").classed("no-scroll", false);

        // Hide the close button
        d3.select(this).style("display", "none");

        // Restore "View Fullscreen" button text
        d3.select(chartCard).select(".expand-chart-btn").text("View Fullscreen");

        // Re-draw the chart to adjust to original dimensions
        if (chartId === "scatter-plot") {
            drawScatterPlot(globalPharmaGDPData);
        } else if (chartId === "bar-chart") {
            drawBarChart(globalPharmaGDPData, currentSelectedYear);
        } else if (chartId === "grouped-bar-chart") {
            drawGroupedBarChart(globalPharmaGDPData, selectedGroupedYears);
        } else if (chartId === "difference-chart") {
            drawDifferenceChart(globalPharmaGDPData);
        }
    });


}).catch(function(error) {
    console.error("Error loading or processing the CSV file:", error);
    d3.select("#data-table").html(`
        <div class="alert alert-danger">
            Error loading data: ${error.message}. Please check the console for details.
        </div>
    `);
});

// Add resize event listener for responsiveness
window.addEventListener('resize', function() {
    if (globalPharmaGDPData.length > 0) {
        initVisualizations(globalPharmaGDPData); // Re-draw all charts on resize
    }
});
