// D3 margin convention for charts
const margin = {top: 30, right: 40, bottom: 60, left: 70};

// Helper function to calculate CAGR
const calculateCAGR = (startValue, endValue, periods) => {
    if (periods <= 0) return 0;
    return (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;
};

// Helper function to clean data values
const cleanValue = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return parseFloat(value);
    
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    return cleaned ? parseFloat(cleaned) : null;
};

// Process the raw CSV data into a usable format
function processData(rawData) {
    if (!rawData || rawData.length === 0) return [];
    
    // Find the rows with actual data
    const ausRow = rawData.find(row => row['Time period'] === 'Australia');
    const ukRow = rawData.find(row => row['Time period'] === 'United Kingdom');
    
    if (!ausRow || !ukRow) return [];
    
    // Extract years from the first row
    const years = [];
    for (let key in rawData[0]) {
        const year = parseInt(key);
        if (!isNaN(year) && year.toString() === key.trim()) {
            years.push(year);
        }
    }
    
    // Process data for each year
    const processedData = years.map(year => {
        return {
            year: year,
            australia: cleanValue(ausRow[year]),
            uk: cleanValue(ukRow[year])
        };
    }).filter(d => d.australia !== null && d.uk !== null);
    
    return processedData;
}

// Calculate and display key statistics
function calculateAndDisplayStats(pharmaData) {
    if (!pharmaData || pharmaData.length === 0) {
        console.error("No data available for statistics calculation");
        d3.select("#aus-avg-spend").text("N/A");
        d3.select("#uk-avg-spend").text("N/A");
        d3.select("#growth-rate-aus").text("N/A");
        d3.select("#growth-rate-uk").text("N/A");
        return;
    }

    const years = pharmaData.map(d => d.year);
    const numYears = years.length;

    const ausAvg = d3.mean(pharmaData, d => d.australia)?.toFixed(0) || 'N/A';
    const ukAvg = d3.mean(pharmaData, d => d.uk)?.toFixed(0) || 'N/A';

    const ausCAGR = numYears > 1 ? 
        calculateCAGR(pharmaData[0].australia, pharmaData[numYears - 1].australia, numYears - 1)?.toFixed(1) + '%' :
        'N/A';
        
    const ukCAGR = numYears > 1 ?
        calculateCAGR(pharmaData[0].uk, pharmaData[numYears - 1].uk, numYears - 1)?.toFixed(1) + '%' :
        'N/A';

    d3.select("#aus-avg-spend").text(`$${ausAvg}`);
    d3.select("#uk-avg-spend").text(`$${ukAvg}`);
    d3.select("#growth-rate-aus").text(ausCAGR);
    d3.select("#growth-rate-uk").text(ukCAGR);
}

// [Rest of your existing functions remain the same...]

// Load and process the CSV data
d3.csv("pharma_data.csv").then(function(rawData) {
    console.log("Raw CSV data:", rawData);
    
    // Process the raw CSV data into our desired format
    const pharmaData = processData(rawData);
    console.log("Processed data:", pharmaData);
    
    if (pharmaData.length === 0) {
        console.error("No valid data could be processed");
        d3.select("#data-table").html(`
            <div class="alert alert-warning">
                Data loaded but could not be processed. Please check the CSV format.
                <br>First few rows: <pre>${JSON.stringify(rawData.slice(0, 3), null, 2)}</pre>
            </div>
        `);
        return;
    }
    
    // Initialize visualizations with the processed data
    initVisualizations(pharmaData);
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
    d3.csv("pharma_data.csv").then(function(rawData) {
        const pharmaData = processData(rawData);
        if (pharmaData.length > 0) {
            initVisualizations(pharmaData);
        }
    });
});