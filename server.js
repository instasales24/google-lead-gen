require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(cors(["*"]));
app.use(express.json());

const PORT = process.env.PORT || 5000;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const GS_KEY = process.env.GS_KEY;
// const SERVICE_ACCOUNT_CREDENTIALS = require("./gsConfig.json");
const top100Cities = require("./cities.json");

async function initializeGoogleSheets() { 
    const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID, {apiKey: GS_KEY});
    await doc.loadInfo();
    console.log(`Loaded spreadsheet: ${doc.title}`);
    return doc;
}

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

app.get("/window-cleaners", async (req, res) => {
    try {
        const radius = 50000;
        const keyword = "window cleaning";
        let allResults = [];

        for (const city of top100Cities) {
            const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${city.lat},${city.lng}&radius=${radius}&keyword=${keyword}&key=${GOOGLE_MAPS_API_KEY}`;

            console.log(`Fetching data for ${city.name}`);
            const response = await axios.get(apiUrl);
            if(!response.ok){
                console.log(response)
                break
            }
            const businesses = response.data.results;
            if(businesses){
                console.log("Success")
            }

            for (const business of businesses) {
                let phoneNumber = await getPlaceDetails(business.place_id);
                console.log({
                    city: city.name,
                    name: business.name,
                    address: business.vicinity,
                    phone: phoneNumber
                })
                allResults.push({
                    city: city.name,
                    name: business.name,
                    address: business.vicinity,
                    rating: business.rating || "N/A",
                    phone: phoneNumber
                });
            }
        }

        res.status(200).json(allResults);
    } catch (error) {
        console.error("Error fetching data:", error.message);
        res.status(500).json({ error: "Failed to fetch window cleaning businesses" });
    }
});

app.get("/save-data", async (req, res) => {
    try {
        const doc = initializeGoogleSheets()

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

app.get("/get-sheet-data", async (req, res) => {
    try {
        const doc = await initializeGoogleSheets();
        const sheet = doc.sheetsByIndex[0];

        const rows = await sheet.getRows();
        const data = rows.map((row) => ({
            Name: row._rawData[0],
            Location: row._rawData[1],
            Address: row._rawData[2],
            Rating: row._rawData[3],
            Phone: row._rawData[4],
        }));

        res.json({ message: "✅ Data fetched successfully", data });
    } catch (error) {
        console.error("Error fetching Google Sheets data:", error.message);
        res.status(500).json({ error: "Failed to fetch Google Sheets data" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});
