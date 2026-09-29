const socket = io();

// 1. Create the map
const map = L.map("map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Rahul Pandit",
}).addTo(map);

// 2. Store one marker per user: { userId: marker }
const markers = {};

// 3. Send MY location to the server whenever it changes
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      socket.emit("send-location", { latitude, longitude });
    },
    (error) => {
      console.error("Location error:", error.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
} else {
  console.error("Geolocation is not supported by your browser.");
}

// 4. When the server sends ANY user's location, show or move their marker
socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]); // user already has a marker: move it
  } else {
    markers[id] = L.marker([latitude, longitude]).addTo(map); // new user: create marker
  }

  // Center the map only on MY own location
  if (id === socket.id) {
    map.setView([latitude, longitude], 16);
  }
});

// 5. When a user leaves, remove their marker
socket.on("user-disconnect", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});