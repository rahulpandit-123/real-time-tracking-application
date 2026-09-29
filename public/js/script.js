const socket = io();

const username = prompt("Enter your name:") || "Guest";

// Create the map
const map = L.map("map").setView([0, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Rahul Pandit",
}).addTo(map);

const markers = {};          // { userId: marker }
const names = {};            // { userId: username }
let myLocation = null;       // my own position
let selectedId = null;       // the user I'm measuring the distance to
let routeControl = null;     // the road route object
let lastRouteTime = 0;       // when the route was last requested
let firstFit = false;        // zoom to fit the route only the first time

const infoBox = document.getElementById("info");

// ---------- Helper functions ----------

function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 80%, 45%)`;
}

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px black;"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function makePopup(id, name) {
  const box = document.createElement("div");

  const title = document.createElement("b");
  title.textContent = id === socket.id ? name + " (You)" : name;
  box.appendChild(title);

  if (id !== socket.id) {
    box.appendChild(document.createElement("br"));
    const button = document.createElement("button");
    button.textContent = "Check distance";
    button.onclick = () => {
      selectedId = id;
      firstFit = true;
      drawRoute(true);
    };
    box.appendChild(button);
  }
  return box;
}

// Turn meters into "350 m" or "2.40 km"
function formatDistance(meters) {
  return meters < 1000
    ? Math.round(meters) + " m"
    : (meters / 1000).toFixed(2) + " km";
}

// Ask for the road route from me to the selected user
function drawRoute(force) {
  if (!selectedId || !myLocation || !markers[selectedId]) return;

  // Don't ask the routing server too often (max once every 10 seconds)
  const now = Date.now();
  if (!force && now - lastRouteTime < 10000) return;
  lastRouteTime = now;

  const otherLocation = markers[selectedId].getLatLng();

  // First time: create the route
  if (!routeControl) {
    routeControl = L.Routing.control({
      waypoints: [myLocation, otherLocation],
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
      }),
      createMarker: () => null,          // we already have our own markers
      addWaypoints: false,
      routeWhileDragging: false,
      fitSelectedRoutes: false,
      show: false,                       // hide the turn-by-turn text panel
      lineOptions: { styles: [{ color: "red", weight: 6 }] },
    }).addTo(map);

    // Route found: show the road distance and time
    routeControl.on("routesfound", (e) => {
      const route = e.routes[0];
      const distance = formatDistance(route.summary.totalDistance);
      const minutes = Math.round(route.summary.totalTime / 60);

      infoBox.style.display = "block";
      infoBox.textContent =
        names[selectedId] + " is " + distance + " away by road (about " + minutes + " min drive)";

      if (firstFit) {
        map.fitBounds(L.latLngBounds(route.coordinates), { padding: [60, 60] });
        firstFit = false;
      }
    });

    // No road found
    routeControl.on("routingerror", () => {
      infoBox.style.display = "block";
      infoBox.textContent = "Could not find a road route to " + names[selectedId];
    });
  } else {
    // Route already exists: just update the start and end points
    routeControl.setWaypoints([myLocation, otherLocation]);
  }
}

// Remove the route and the info box
function clearRoute() {
  if (routeControl) {
    map.removeControl(routeControl);
    routeControl = null;
  }
  infoBox.style.display = "none";
  selectedId = null;
}

// ---------- Send MY location ----------
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      myLocation = L.latLng(latitude, longitude);

      socket.emit("send-location", { username, latitude, longitude });
      drawRoute(false); // refresh the route as I move
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
    const color = id === socket.id ? "blue" : colorFromId(id);
    markers[id] = L.marker([latitude, longitude], { icon: makeIcon(color) })
      .addTo(map)
      .bindPopup(makePopup(id, username));

    if (id === socket.id) {
      map.setView([latitude, longitude], 16);
    }
  }

  if (id === selectedId) drawRoute(false); // refresh the route if they moved
});

// ---------- Someone left ----------
socket.on("user-disconnect", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
    delete names[id];
  }
  if (id === selectedId) clearRoute();
});