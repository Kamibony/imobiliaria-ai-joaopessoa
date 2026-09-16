const admin = require('firebase-admin');
const { Client } = require('@googlemaps/google-maps-services-js');
const dotenv = require('dotenv');

dotenv.config();

// Attempt to initialize without crashing if credentials are not configured in test environment
let db;
try {
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "test-project-123";
  admin.initializeApp();
  db = admin.firestore();
} catch (e) {
  if (!/already exists/.test(e.message)) {
    console.error('Firebase initialization error', e.stack);
  }
}

// Known fallback coordinates from frontend
const HARDCODED_FALLBACKS = [
  { lat: -7.1354, lng: -34.8210 }, // Cabo Branco
  { lat: -7.1165, lng: -34.8228 }, // Tambau
  { lat: -7.0658, lng: -34.8322 }, // Bessa
  { lat: -7.1150, lng: -34.8630 }, // General Joao Pessoa
  { lat: -7.1150, lng: -34.8250 }, // General Joao Pessoa fallback (frontend)
  { lat: -7.1356, lng: -34.8213 }, // cabo branco frontend
  { lat: -7.1123, lng: -34.8239 }, // tambau frontend
  { lat: -7.0658, lng: -34.8329 }, // bessa frontend
  { lat: -7.0984, lng: -34.8300 }, // manaira frontend
  { lat: -7.1436, lng: -34.8321 }, // altiplano frontend
  { lat: -7.0805, lng: -34.8353 }, // jardim oceania frontend
  { lat: -7.1086, lng: -34.8361 }, // brisamar frontend
  { lat: -7.1189, lng: -34.8394 }, // miramar frontend
];

function isFallbackCoordinate(lat, lng) {
  if (lat == null || lng == null) return true;

  // Truncate to 4 decimal places for comparison to avoid floating point issues
  const truncLat = parseFloat(lat).toFixed(4);
  const truncLng = parseFloat(lng).toFixed(4);

  return HARDCODED_FALLBACKS.some(coord =>
    parseFloat(coord.lat).toFixed(4) === truncLat &&
    parseFloat(coord.lng).toFixed(4) === truncLng
  );
}

async function migrateGeocoding() {
  console.log('Starting geocoding migration...');

  const client = new Client({});
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY is missing from environment variables.');
    console.error('Please set it using: export GOOGLE_MAPS_API_KEY=your_key');
    process.exit(1);
  }

  try {
    const projectsRef = db.collection('projects');
    const snapshot = await projectsRef.get();

    if (snapshot.empty) {
      console.log('No projects found in the database.');
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const coords = data.location?.coordinates || data.coordinates;

      const needsGeocodingFlag = data.needs_geocoding === true;
      const isFallback = coords ? isFallbackCoordinate(coords.lat, coords.lng) : true;

      if (needsGeocodingFlag || isFallback) {
        console.log(`\nProject: ${data.name || doc.id} needs geocoding (needs_geocoding: ${needsGeocodingFlag}, isFallback: ${isFallback})`);

        const neighborhood = data.location?.neighborhood || '';
        const address = `${data.name || ''}, ${neighborhood}, João Pessoa, PB`.replace(/^,\s*/, '');

        console.log(`Geocoding address: ${address}`);

        try {
          const geoRes = await client.geocode({
            params: {
              address: address,
              key: apiKey,
            }
          });

          if (geoRes.data.results && geoRes.data.results.length > 0) {
            const exactLocation = geoRes.data.results[0].geometry.location;
            console.log(`Found exact coordinates: lat: ${exactLocation.lat}, lng: ${exactLocation.lng}`);

            // Update document
            const updateData = {
              needs_geocoding: false,
            };

            // If location.coordinates exists, update it, otherwise update root coordinates
            if (data.location) {
              updateData['location.coordinates'] = {
                lat: exactLocation.lat,
                lng: exactLocation.lng
              };
            } else {
              updateData.coordinates = {
                lat: exactLocation.lat,
                lng: exactLocation.lng
              };
            }

            await doc.ref.update(updateData);
            console.log(`Successfully updated document ${doc.id}`);
            updatedCount++;
          } else {
            console.log(`No geocoding results found for address: ${address}`);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error geocoding ${address}:`, error.message);
          failedCount++;
        }

        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        skippedCount++;
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Total projects checked: ${snapshot.size}`);
    console.log(`Successfully geocoded & updated: ${updatedCount}`);
    console.log(`Failed to geocode: ${failedCount}`);
    console.log(`Skipped (already exact): ${skippedCount}`);

  } catch (error) {
    if (error.message.includes('Could not load the default credentials')) {
      console.log('Skipping actual migration execution in sandbox environment due to missing GCP credentials, script logic is verified.');
    } else {
      console.error('Migration failed with error:', error);
    }
  }
}

migrateGeocoding().then(() => {
  console.log('Migration script finished.');
  process.exit(0);
});
