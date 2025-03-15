require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");

// Load environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Load Google credentials directly from the JSON file in the root folder
const SERVICE_ACCOUNT_CREDENTIALS = require("./gsConfig.json");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;

console.log("Using API Key:", GOOGLE_MAPS_API_KEY);
console.log("Server running on port", PORT);

const gsBaseURL = "https://sheets.googleapis.com"

// **Top 100 US Cities (shortened for example)**
const top100Cities = [
    { name: "New York, NY", lat: 40.7128, lng: -74.0060 },
    { name: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
    { name: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
    { name: "Houston, TX", lat: 29.7604, lng: -95.3698 },
    { name: "Phoenix, AZ", lat: 33.4484, lng: -112.0740 },
    { name: "Philadelphia, PA", lat: 39.9526, lng: -75.1652 }
];

// **Test Route**
app.get("/", (req, res) => {
    res.json({ message: "Server is running!" });
});

// **Function to Get Phone Number**
async function getPlaceDetails(placeId) {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number&key=${GOOGLE_MAPS_API_KEY}`;

    try {
        const response = await axios.get(detailsUrl);
        return response.data.result?.formatted_phone_number || "No Phone Number";
    } catch (error) {
        console.error("Error fetching place details:", error.message);
        return "Error Fetching Number";
    }
}

// **Google Maps API - Fetch Window Cleaners for Top 100 Cities**
app.get("/api/window-cleaners", async (req, res) => {
    try {
        const radius = 50000;
        const keyword = "window cleaning";
        let allResults = [];

        for (const city of top100Cities) {
            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${city.lat},${city.lng}&radius=${radius}&keyword=${keyword}&key=${GOOGLE_MAPS_API_KEY}`;

            console.log(`Fetching data for ${city.name}`);
            const response = await axios.get(apiUrl);
            const businesses = response.data.results;

            for (const business of businesses) {
                let phoneNumber = await getPlaceDetails(business.place_id);

                allResults.push({
                    city: city.name,
                    name: business.name,
                    address: business.vicinity,
                    rating: business.rating || "N/A",
                    phone: phoneNumber
                });
            }
        }

        res.json(allResults);
    } catch (error) {
        console.error("Error fetching data:", error.message);
        res.status(500).json({ error: "Failed to fetch window cleaning businesses" });
    }
});

// **Google Sheets - Store Data**
app.get("/api/save-data", async (req, res) => {
    try {
        const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID);

        // Authenticate using the service account JSON key
        await doc.useServiceAccountAuth({
            client_email: SERVICE_ACCOUNT_CREDENTIALS.client_email,
            private_key: SERVICE_ACCOUNT_CREDENTIALS.private_key.replace(/\\n/g, '\n'),
        });

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        for (const city of top100Cities) {
            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${city.lat},${city.lng}&radius=50000&keyword=window cleaning&key=${GOOGLE_MAPS_API_KEY}`;

            console.log(`Fetching data for ${city.name}`);
            const response = await axios.get(apiUrl);
            const businesses = response.data.results;

            for (const business of businesses) {
                let phoneNumber = await getPlaceDetails(business.place_id);

                await sheet.addRow({
                    Name: business.name,
                    Location: city.name,
                    Address: business.vicinity,
                    Rating: business.rating || "N/A",
                    Phone: phoneNumber
                });
            }
        }

        res.json({ message: "Data saved to Google Sheets!" });
    } catch (error) {
        console.error("Error saving data:", error.message);
        res.status(500).json({ error: "Failed to save data to Google Sheets" });
    }
});

app.get("/sheetById/:id", async (req, res) => {
    try {
        const sheetId = req.params.id;
        const response = await axios.get(`${gsBaseURL}/v4/spreadsheets/${sheetId}`, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        res.status(200).json({ message: "LFG", data: response.data });
    } catch (error) {
        console.error("Error fetching spreadsheet:", error.message);
        res.status(400).json({ message: "My bad g it just ain't it today", error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
