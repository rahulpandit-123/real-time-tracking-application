const socket = io(); // Initialize the socket connection

// Check if geolocation is available
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            // Emit location to the server
            console.log("Sending location to server:", latitude, longitude);  // Debugging
            socket.emit("send-location", { latitude, longitude });
        },
        (error) => {
            console.error("Error obtaining location:", error);
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
} else {
    console.error("Geolocation is not supported by your browser.");
}

// Initialize the Leaflet map
const map = L.map("map").setView([0, 0], 2); // Initial view with zoom level 2
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "rahul pandit"
}).addTo(map);

const markers = {};

// Handle receiving location updates
socket.on("receive-location", (data) => {
    const { id, latitude, longitude } = data;
    console.log(`Received location for id: ${id} - Latitude: ${latitude}, Longitude: ${longitude}`);
    
    // Set map view to new location
    map.setView([latitude, longitude], 16);

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = L.marker([latitude, longitude]).addTo(map);
    }
});

// Handle user disconnects
socket.on("user-disconnect", (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});
