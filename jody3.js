// Cesium.Ion.defaultAccessToken = 'add-token-here'; // DOESN'T SEEM TO BE NEEDED

// Options - TODO: make available by UI
let showLabels = true;

let selectedEntityName = null;


document.addEventListener("DOMContentLoaded", function(event) {
  run();
});

async function run() {
  const viewer = setupViewer(); // viewer is global

  const groundStations = await fetchGroundStationsToMonitor();
  const groundStationEntities = addGroundStations(groundStations, viewer);

  const satellites = await fetchSatellitesToMonitor();
  const satColors = await fetchSatelliteColors();
  await fetchTLEsAndSatRecs(satellites, satColors); // updates each sats entry with a satrec property
  
  buildTable(groundStationEntities, satellites, viewer);

  mapSatellites(satellites, groundStationEntities, viewer);
}

function setupViewer() {
  // Initialize the Cesium viewer.

  const viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: new Cesium.TileMapServiceImageryProvider({
      url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    }),
    baseLayerPicker: false, geocoder: true, homeButton: true, infoBox: true,
    navigationHelpButton: true, sceneModePicker: true
  });

  viewer.scene.globe.enableLighting = true;

  viewer.scene.mode = Cesium.SceneMode.SCENE2D;

  return viewer;
}

function addGroundStations(groundStations, viewer)
{
  const groundStationEntities = [];

  groundStations.forEach(gs => {
    gsEntity = viewer.entities.add({
      name: gs.Name,
      position: Cesium.Cartesian3.fromDegrees(gs.Longitude, gs.Latitude, gs.Height),
      point: {
        pixelSize: 5,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: gs.Name,
        font: "14pt monospace",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -9),
      },
    });
  
    groundStationEntities.push(gsEntity);
  });

  return groundStationEntities;
}

async function fetchGroundStationsToMonitor() {
  const response = await fetch('data/groundStations/groundStations.json');
  if (!response.ok) {
    throw new Error(`An error has occured: ${response.status}`);
  }

  const sats = await response.json();
  return sats;
}

async function fetchSatelliteColors() {
  const response = await fetch('data/sats/satelliteColors.json');
  if (!response.ok) {
    throw new Error(`An error has occured: ${response.status}`);
  }

  const colors = await response.json();
  return colors;
}


async function fetchSatellitesToMonitor() {
  // These 2 lines are published by NORAD and allow us to predict where
  // the ISS is at any given moment. They are regularly updated.
  // Get the latest from: https://celestrak.org/NORAD/elements/gp.php?CATNR=25544
  const response = await fetch('data/sats/satsToMonitor.json');
  if (!response.ok) {
    throw new Error(`An error has occured: ${response.status}`);
  }

  const sats = await response.json();
  return sats;
}

async function fetchTLEsAndSatRecs(satellites, colors)
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
}


function mapSatellites(satellites, groundStationEntities, viewer)
{
  window.setInterval(() => {
    satellites.forEach(satEntry => {
      if (satEntry.SatRec)
        mapSatellite(satEntry, groundStationEntities, viewer);
    });
    updateTable(satellites, groundStationEntities, viewer);
  }, 1000);
}

  function mapSatellite(satEntry, groundStationEntities, viewer)
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
  }

  function buildTable(groundStationEntities, satellites, viewer)
  {
    // Create table
    const table = document.getElementById('the-table');
    table.onclick = handleTableItemClick;

    // Create header row: col for GS header and one col for each sat
    const header = table.createTHead();
    let col = 0;
    let row = header.insertRow(0);
    let cell = row.insertCell(col++);
    cell.innerHTML = "GS";

    satellites.forEach(satEntry => {
      if (satEntry.ColorName) {
        cell = row.insertCell(col++);
        cell.innerHTML = `${satEntry.Name}<br>${satEntry.ColorName}`;
        cell.viewer = viewer;
        cell.satEntry = satEntry; // won't have the viewerEntity yet so just store the satEntry which will eventually have the viewerEntity on it
        cell.onclick = (event) => handleTableItemClick(event, null, satEntry, viewer);
      }
    });

    // Create GS row and cell for each sat
    groundStationEntities.forEach((gsEntity, index) => {
      row = table.insertRow(index+1); // +1 to account for header row
      row.viewerEntity = gsEntity;
      row.dataset.gs = gsEntity.name;
      col = 0;
      cell = row.insertCell(col++);
      cell.innerHTML = gsEntity.name;

      satellites.forEach(satEntry => {
        if (satEntry.ColorName) {
          cell = row.insertCell(col++);
          cell.innerHTML = '';
          cell.dataset.sat = satEntry.Name;
          cell.viewer = viewer;
          cell.satEntry = satEntry; // won't have the viewerEntity yet so just store the satEntry which will eventually have the viewerEntity on it
          // cell.onclick = (event) => handleTableItemClick(event, null, satEntry, viewer);
        }
      });  
    });
  }

  async function handleTableItemClick(event)
  {
    const viewer = event?.target?.viewer;
    const viewerEntity = event?.target?.viewerEntity ?? event?.target?.satEntry?.viewerEntity;
    if (!viewer || !viewerEntity) return;

    selectedEntityName = viewerEntity.name;

    console.log(viewerEntity);
    const result = await viewer.flyTo(viewerEntity, {offset: new Cesium.HeadingPitchRange(0, -2, 10000000)});
    if (result) {
      viewer.selectedEntity = viewerEntity;
    }
  }

  function updateTable(satellites, groundStationEntities, viewer)
  {
    groundStationEntities.forEach((gsEntity, index) => {
      let row = null;
      satellites.forEach(satEntry => {
        if (satEntry.ColorName) {
          gsPos = gsEntity.position.getValue();
          satPos = satEntry.viewerEntity.position.getValue();
          const distanceFromGroundStation0 = Cesium.Cartesian3.distance(gsPos, satPos);
          console.log(`Distance from ${gsEntity.name} to ${satEntry.Name}: ${Math.round(distanceFromGroundStation0/1000)} km`);
      
          const angleFromGroundStation = roundTo(calculateAngleBetweenTwoPoints(gsPos, satPos, viewer), 1);
          console.log(`Angle from ${gsEntity.name} to ${satEntry.Name}: ${angleFromGroundStation}`);
      
          // Consider "access" to mean "line of sight between the ground location, and the satellite unobstructed by the earth sphere (elevation angle > 0 + terrain/buildings)"
          const groundStationHasAccess = angleFromGroundStation > 10;
          console.log(`    ${gsEntity.name} hasAccess: ${groundStationHasAccess}`);
      
          const info = `Angle: ${angleFromGroundStation} degrees<br/>Has access: ${groundStationHasAccess}`;
          row = updateTableCell(row, gsEntity.name, satEntry.Name, info);
        }
      });  
    });
  }

  function roundTo(num, decimals)
  {
    const tenFactor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * tenFactor) / tenFactor;
  }


  function updateTableCell(row, groundStationName, satName, info)
  {
    row = row ?? document.querySelector(`[data-gs="${groundStationName}"]`);
    const cell = row.querySelector(`[data-sat="${satName}"]`);
    if (!cell) return;

    cell.innerHTML = info;

    return row;
  }

  let firstTime = 1;
  function calculateAngleBetweenTwoPoints(startPoint, endPoint, viewer) // both Cartesian3
  {
    // var startPoint1 = new Cesium.Cartesian3.fromDegrees(-107, 30, 3000);
    // var endPoint1 = new Cesium.Cartesian3.fromDegrees(-112, 25, 1000000);

    // if (firstTime) {
    //   firstTime = 0;
    //   // Add the line
    //   var line =  viewer.entities.add({
    //       polyline : {
    //                   positions : [startPoint, endPoint],
    //                   width : 2,
    //                   material : Cesium.Color.BLUE,
    //                   followSurface : new Cesium.ConstantProperty(false)
    //       }
    //   });
    // // viewer.zoomTo(line);
    // }
    
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