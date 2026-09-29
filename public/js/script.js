const socket = io();

// Ask for a name when the page opens
const username = prompt("Enter your name:") || "Guest";

// Create the map
const map = L.map("map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Rahul Pandit",
}).addTo(map);

const markers = {};      // { userId: marker }
const names = {};        // { userId: username }
let myLocation = null;   // my own position
let selectedId = null;   // the user I'm measuring the distance to
let routeLine = null;    // the line drawn on the map

// ---------- Helper functions ----------

// Every user gets their own color, based on their id
function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 80%, 45%)`;
}

// A colored circle used as the marker icon
function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px black;"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// The popup shown when you click a marker
function makePopup(id, name) {
  const box = document.createElement("div");

  const title = document.createElement("b");
  title.textContent = id === socket.id ? name + " (You)" : name;
  box.appendChild(title);

  // Only other users get the "Check distance" button
  if (id !== socket.id) {
    box.appendChild(document.createElement("br"));
    const button = document.createElement("button");
    button.textContent = "Check distance";
    button.onclick = () => {
      selectedId = id;
      drawRoute(true);
    };
    box.appendChild(button);
  }
  return box;
}

// Draw the line between me and the selected user
function drawRoute(zoomToFit) {
  if (!selectedId || !myLocation || !markers[selectedId]) return;

  const otherLocation = markers[selectedId].getLatLng();

  // Leaflet calculates the distance in meters
  const meters = map.distance(myLocation, otherLocation);
  const text =
    meters < 1000
      ? Math.round(meters) + " m"
      : (meters / 1000).toFixed(2) + " km";

  // Remove the old line, then draw a new one
  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline([myLocation, otherLocation], {
    color: "red",
    weight: 4,
    dashArray: "8",
  }).addTo(map);

  routeLine.bindTooltip(names[selectedId] + " is " + text + " away", {
    permanent: true,
  }).openTooltip();

  if (zoomToFit) {
    map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
  }
}

// ---------- Send MY location ----------
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      myLocation = L.latLng(latitude, longitude);

      socket.emit("send-location", { username, latitude, longitude });
      drawRoute(false); // keep the line updated as I move
    },
    (error) => console.error("Location error:", error.message),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

// ---------- Receive EVERYONE's location ----------
socket.on("receive-location", (data) => {
  const { id, username, latitude, longitude } = data;
  names[id] = username;

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
  } else {
    // My marker is blue, other users get their own color
    const color = id === socket.id ? "blue" : colorFromId(id);
    markers[id] = L.marker([latitude, longitude], { icon: makeIcon(color) })
      .addTo(map)
      .bindPopup(makePopup(id, username));

    // Center the map on me the first time
    if (id === socket.id) {
      map.setView([latitude, longitude], 16);
    }
  }

  if (id === selectedId) drawRoute(false); // update the line if they moved
});

// ---------- Someone left ----------
socket.on("user-disconnect", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
    delete names[id];
  }
  // Remove the line if it pointed to this user
  if (id === selectedId) {
    if (routeLine) map.removeLayer(routeLine);
    routeLine = null;
    selectedId = null;
  }
});