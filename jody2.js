// Cesium.Ion.defaultAccessToken = 'add-token-here';

// Options - TODO: make available by UI

let showLabels = true;


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
let selectedEntityName = null;


const groundStationEntities = [];


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
  const rsa = viewer.entities.add({
    name: "Redstone Arsenal",
    position: Cesium.Cartesian3.fromDegrees(-86.64752499562553, 34.68538740550587),
    point: {
      pixelSize: 5,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: "Redstone Arsenal",
      font: "14pt monospace",
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -9),
    },
  });

  groundStationEntities.push(rsa);

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
    console.log(`${name}: ${Math.round(position.height)}km ALT`);

    // Visualize the satellite at this location with a red dot.
    if (satEntry.viewerEntity)
    {  // already have an entity, so just update its position
      satEntry.viewerEntity.position = Cesium.Cartesian3.fromRadians(
        position.longitude, position.latitude, position.height * 1000
      );
    }
    else
    { // need to create the entity the first time and store a reference to it on satEntry
      const viewerEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromRadians(
          position.longitude, position.latitude, position.height * 1000
        ),
        point: { pixelSize: 5, color: satEntry.Color },
        name: name,
        description: name
      });

      if (showLabels) {
        viewerEntity.label = {
          text: name,
          font: "14pt monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -9),
        };
      }
      satEntry.viewerEntity = viewerEntity;
    }

    const gs = groundStationEntities[0];
    gsPos = gs.position.getValue();
    satPos = satEntry.viewerEntity.position.getValue();
    const distanceFromGroundStation0 = Cesium.Cartesian3.distance(gsPos, satPos);
    console.log(`Distance from ${gs.name} to ${name}: ${Math.round(distanceFromGroundStation0/1000)} km`);

    const angleFromGroundStation0 = calculateAngleBetweenTwoPoints(gsPos, satPos);
    console.log(`Angle from ${gs.name} to ${name}: ${angleFromGroundStation0}`);

    // Consider "access" to mean "line of sight between the ground location, and the satellite unobstructed by the earth sphere (elevation angle > 0 + terrain/buildings)"
    const groundStation0HasAccess = angleFromGroundStation0 > 10;
    console.log(`    ${gs.name} hasAccess: ${groundStation0HasAccess}`);
  }

  function buildLegend(satellites)
  {
    const legend = document.getElementById('legend');

    legend.appendChild(document.createTextNode('Ground Stations'));
    const ulGs = document.createElement("ul");
    legend.appendChild(ulGs);
    groundStationEntities.forEach(gs => {
      const li = document.createElement("li");
      ulGs.appendChild(li);
      li.textContent = gs.name;
      li.viewerEntity = gs;
      li.onclick = handleLegendItemClick;
    });

    legend.appendChild(document.createElement('br'));
    legend.appendChild(document.createTextNode('Satellites'));

    const ulSats = document.createElement("ul");
    legend.appendChild(ulSats);
    satellites.forEach(satEntry => {
      if (satEntry.ColorName) {
        const li = document.createElement("li");
        ulSats.appendChild(li);
        li.textContent = `${satEntry.Name}: ${satEntry.ColorName}`;
        li.satEntry = satEntry; // won't have the viewerEntity yet so just store the satEntry which will eventually have the viewerEntity on it
        li.onclick = handleLegendItemClick;
      }
    });

    async function handleLegendItemClick(event)
    {
      const viewerEntity = event?.target?.viewerEntity ?? event?.target?.satEntry?.viewerEntity;
      if (!viewerEntity) return;

      selectedEntityName = viewerEntity.name;

      console.log(viewerEntity);
      // viewer.zoomTo(viewerEntity);
      // viewer.trackedEntity = viewerEntity;
      const result = await viewer.flyTo(viewerEntity, {offset: new Cesium.HeadingPitchRange(0, -2, 10000000)});
      if (result) {
        viewer.selectedEntity = viewerEntity;
      }
    }
  }

  function buildTable(groundStations, satellites)
  {
    const table = document.getElementById('the-table');


  }

  let firstTime = 1;
  function calculateAngleBetweenTwoPoints(startPoint, endPoint) // both Cartesian3
  {
    // var startPoint1 = new Cesium.Cartesian3.fromDegrees(-107, 30, 3000);
    // var endPoint1 = new Cesium.Cartesian3.fromDegrees(-112, 25, 1000000);

    if (firstTime) {
      firstTime = 0;
      // Add the line
      var line =  viewer.entities.add({
          polyline : {
                      positions : [startPoint, endPoint],
                      width : 2,
                      material : Cesium.Color.BLUE,
                      followSurface : new Cesium.ConstantProperty(false)
          }
      });
      // // viewer.zoomTo(line);
    }
    
    //Obtain vector by taking difference of the end points
    var scratch1= new Cesium.Cartesian3();
    var difference = Cesium.Cartesian3.subtract(endPoint, startPoint, scratch1);
    difference = Cesium.Cartesian3.normalize(difference, scratch1);
    console.log("Difference: " + difference);
    
    //Obtain surface normal by normalizing the starting point position
    var scratch2 = new Cesium.Cartesian3();
    var surfaceNormal = Cesium.Cartesian3.normalize(startPoint, scratch2);
    console.log("Surface normal: " + surfaceNormal);
    
    //Take the dot product of your given vector and the surface normal
    var dotProduct = Cesium.Cartesian3.dot(difference, surfaceNormal);
    console.log("Dot product: " + dotProduct);
    
    //Arcos the result
    var angle = 90 - Math.acos(dotProduct) * Cesium.Math.DEGREES_PER_RADIAN ;
    console.log("Angle: " + angle);

    return angle;
  }