// Mark's token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZGQ3Yzg5Ny1iZmI4LTQ5ZWUtOTlkMS05YzQzMDljMmZiODciLCJpZCI6ODgzODksImlhdCI6MTY0OTE4NzM4OH0.Ooa4dDAgrPmaTmfLZoEAcIwSOrTPmBKPg2DBZHEQpvw';

const colors = [
  // { Color: "#696969", Name: "dimgray" },
  { Color: "#556b2f", Name: "darkolivegreen" },
  { Color: "#800000", Name: "maroon" },
  { Color: "#483d8b", Name: "darkslateblue" },
  { Color: "#008000", Name: "green" },
  { Color: "#3cb371", Name: "mediumseagreen" },
  { Color: "#008b8b", Name: "darkcyan" },
  { Color: "#cd853f", Name: "peru" },
  { Color: "#4682b4", Name: "steelblue" },
  { Color: "#00008b", Name: "darkblue" },
  { Color: "#32cd32", Name: "limegreen" },
  { Color: "#800080", Name: "purple" },
  { Color: "#b03060", Name: "maroon3" },
  { Color: "#ff0000", Name: "red" },
  { Color: "#ffa500", Name: "orange" },
  { Color: "#ffff00", Name: "yellow" },
  { Color: "#00ff00", Name: "lime" },
  { Color: "#00fa9a", Name: "mediumspringgreen" },
  { Color: "#8a2be2", Name: "blueviolet" },
  { Color: "#dc143c", Name: "crimson" },
  { Color: "#0000ff", Name: "blue" },
  { Color: "#adff2f", Name: "greenyellow" },
  { Color: "#b0c4de", Name: "lightsteelblue" },
  { Color: "#ff00ff", Name: "fuchsia" },
  { Color: "#1e90ff", Name: "dodgerblue" },
  { Color: "#fa8072", Name: "salmon" },
  { Color: "#ff1493", Name: "deeppink" },
  { Color: "#7b68ee", Name: "mediumslateblue" },
  { Color: "#f5deb3", Name: "wheat" },
  { Color: "#ee82ee", Name: "violet" },
  { Color: "#7fffd4", Name: "aquamarine" },
  { Color: "#ffc0cb", Name: "pink" }    
];

let viewer = null;
let selectedSatName = null;


document.addEventListener("DOMContentLoaded", function(event) {
  run();
});

async function run() {
  setupViewer(); // viewer is global

  addGroundStations();

  const sats = await fetchSatellitesToMonitor();

  await fetchTLEsAndSatRecs(sats); // updates each sats entry with a satrec property

  mapSatellites(sats);
}

function setupViewer() {
  // Initialize the Cesium viewer.

  viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: new Cesium.TileMapServiceImageryProvider({
      url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    }),
    baseLayerPicker: false, geocoder: true, homeButton: true, infoBox: true,
    navigationHelpButton: true, sceneModePicker: true
  });

  // viewer = new Cesium.Viewer('cesiumContainer', {
  //   terrainProvider: Cesium.createWorldTerrain(),
  // //   imageryProvider: new Cesium.TileMapServiceImageryProvider({
  // //     url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
  // // }),
  // baseLayerPicker: false, geocoder: false, homeButton: false, infoBox: false,
  // navigationHelpButton: false, sceneModePicker: false
  // });


  viewer.scene.globe.enableLighting = true;

  viewer.scene.mode = Cesium.SceneMode.SCENE2D;
}

async function addGroundStations()
{
  // const citizensBankPark = viewer.entities.add({
  //   name: "Citizens Bank Park",
  //   position: Cesium.Cartesian3.fromDegrees(-75.166493, 39.9060534),
  //   point: {
  //     pixelSize: 5,
  //     color: Cesium.Color.RED,
  //     outlineColor: Cesium.Color.WHITE,
  //     outlineWidth: 2,
  //   },
  //   label: {
  //     text: "Citizens Bank Park",
  //     font: "14pt monospace",
  //     style: Cesium.LabelStyle.FILL_AND_OUTLINE,
  //     outlineWidth: 2,
  //     verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
  //     pixelOffset: new Cesium.Cartesian2(0, -9),
  //   },
  // });

  // const home = viewer.entities.add({
  //   name: "Jody's House",
  //   position: Cesium.Cartesian3.fromDegrees(34.86232116401732, -86.75911849789242),
  //   point: {
  //     pixelSize: 5,
  //     color: Cesium.Color.BLUE,
  //     outlineColor: Cesium.Color.WHITE,
  //     outlineWidth: 2,
  //   },
  //   label: {
  //     text: "Jody Brooks' House",
  //     font: "14pt monospace",
  //     style: Cesium.LabelStyle.FILL_AND_OUTLINE,
  //     outlineWidth: 2,
  //     verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
  //     pixelOffset: new Cesium.Cartesian2(0, -9),
  //   },
  // });

  // viewer.zoomTo(viewer.entities);

  
}



async function fetchSatellitesToMonitor() {
  // These 2 lines are published by NORAD and allow us to predict where
  // the ISS is at any given moment. They are regularly updated.
  // Get the latest from: https://celestrak.org/NORAD/elements/gp.php?CATNR=25544
  const response = await fetch('sats/satsToMonitor.json');
  if (!response.ok) {
    throw new Error(`An error has occured: ${response.status}`);
  }

  const sats = await response.json();
  return sats;
}

async function fetchTLEsAndSatRecs(satellites)
{
  let index = 0;
  await Promise.all(satellites.map(async (satEntry) => {
    const catnr = satEntry.CATNR
    const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}`);
    if (!response.ok) {
      throw new Error(`An error has occured: ${response.status}`);
    }

    const data = await response.text();

    if (!data || data == 'No GP data found') return;

    const tle = data.substring(data.indexOf('\n')+1);
    console.log(`${satEntry.Name} TLE:`);
    console.log(tle);
    console.log("");

    const satrec = satellite.twoline2satrec(
      tle.split('\n')[0].trim(), 
      tle.split('\n')[1].trim()
    );

    // Just add the satrec onto the existing satEntry
    satEntry.SatRec = satrec;

    // Go ahead and give it a color while we're here
    const colorIdx = index % colors.length;
    const colorEntry = colors[colorIdx];
    satEntry.Color = Cesium.Color.fromCssColorString(colorEntry.Color);
    satEntry.ColorName = colorEntry.Name;
    index++;
  }));

  buildLegend(satellites);
}


function mapSatellites(sats)
{
  window.setInterval(() => {
    viewer.entities.removeAll();
    sats.forEach(satEntry => {
      if (satEntry.SatRec)
        mapSatellite(satEntry);
    });
  }, 1000);
}

  function mapSatellite(satEntry)
  {
    const satrec = satEntry.SatRec;
    if (!satrec) return;
    const name = satEntry.Name;
    const now = new Date();

    // Give SatelliteJS the TLE. Get back a longitude, latitude, height (km).
    const positionAndVelocity = satellite.propagate(satrec, now);
    const gmst = satellite.gstime(now);


    if (!positionAndVelocity.position) return; // bail if didn't calculate right

    const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

    // Visualize the satellite at this location with a red dot.
    const satellitePoint = viewer.entities.add({
      position: Cesium.Cartesian3.fromRadians(
        position.longitude, position.latitude, position.height * 1000
      ),
      point: { pixelSize: 5, color: satEntry.Color },
      name: name,
      description: name,
      label: {
        text: name,
        font: "14pt monospace",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -9),
      },
    });

    satEntry.satellitePoint = satellitePoint;

    if (selectedSatName == satEntry.Name) {
      viewer.selectedEntity = null;
      // viewer.trackedEntity = satellitePoint;
    }
  }

  function buildLegend(satellites) {
    const legend = document.getElementById('legend');
    const ul = document.createElement("ul");
    legend.appendChild(ul);
    satellites.forEach(satEntry => {
      if (satEntry.ColorName) {
        const li = document.createElement("li");
        ul.appendChild(li);
        li.textContent = `${satEntry.Name}: ${satEntry.ColorName}`;
        li.satEntry = satEntry;
        li.onclick = handleLegendItemClick;
      }
    });

    async function handleLegendItemClick(event)
    {
      const satEntry = event?.target?.satEntry;
      if (!satEntry) return;

      selectedSatName = satEntry.Name;

      const satellitePoint = satEntry.satellitePoint;
      console.log(satEntry);
      // viewer.zoomTo(satellitePoint);
      // viewer.trackedEntity = satellitePoint;
      const result = await viewer.flyTo(satellitePoint, {offset: new Cesium.HeadingPitchRange(0, -2, 10000000)});
      if (result) {
        viewer.selectedEntity = satellitePoint;
      }
    }
  }