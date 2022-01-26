

import * as L from 'leaflet';
import {osmtogeojson} from 'osmtogeojson';
import * as turf from 'turf';
import './leaflet.indexedfeaturelayer.js';
import './leaflet.rangedmarker.js';
import './leaflet.light.js';

// unused:
//const seamap_wikidata_sparql_query = `
//			SELECT ?item ?itemLabel ?location ?height ?focalHeight ?sequence
//			WHERE 
//			{
//			  ?item wdt:P31 wd:Q39715.
//			  ?item wdt:P625 ?location.
//			  OPTIONAL {
//				?item wdt:P2048 ?height.
//				?item wdt:P2923 ?focalHeight.
//				?item wdt:P1030 ?sequence.
//			  }
//			  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
//			}
//`


let map = L.map('seamap', {attributionControl: false})
  // .setView([54.2, 2.6], 6) // set initial view to UK
  .setView([41.348, -70.834], 6) // set initial view to norhteast US  // TODO configurable
  .addControl(L.control.attribution({
    position: 'bottomright',
    prefix: 'Made by <a href="https://www.geodienst.xyz/">Geodienst</a>'
  }));

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
  detectRetina: true,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
}).addTo(map);

let bounds = map.getBounds();


function bbox(bounds) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return [sw.lat, sw.lng, ne.lat, ne.lng];
}

// use current map view as bounding box for query:
const bbox_coords = bbox(bounds);
console.debug(bbox_coords);

// or use this toQuery the entire world instead of what's in view of the map
// const bbox_coords = [-90, -180, 90, 180] 

// TODO may need to re-query if map view changes?


// Query to send to www.overpass-api.de to receive only seamark data:

// TODO improve performance: perhaps instead of a union, first find all seamarks, then filter with a union of sequence and character. note that
// most seamarks with a "character" will probably have a "sequence" (but not all) (and some have a sequence but no character)
// only choose "seamark:type"="landmark" or "light_major" or "light_minor" (or "light_vessel". Are there any of those?). This omits smaller channel navigation buoys etc.

const query = `
			[out:json][timeout:25];
			(
				node ["seamark:type"~"landmark|light_major|light_minor|light_vessel"] ["seamark:light:sequence"] ({${bbox_coords}});
				node ["seamark:type"~"landmark|light_major|light_minor|light_vessel"] ["seamark:light:character"] ({${bbox_coords}});
			);
			out body;
			>;
			out skel qt;
`;


//const cachefile = 'data-full.json'
const cachefile = 'interpreter.json';
//let url = 'http://www.overpass-api.de/api/interpreter?data=' + encodeURIComponent(query)
const url = cachefile;


// TODO update a progress indicator/icon for the user during this query and any others, show errors
let data = fetch(url)
  .then(resp => (resp.json()))

  // TODO if return JSON is missing geojson elements, return error (with contents of "remark" json property) before trying to parse geojson
  // TODO fetch cachefile instead above and if fail, call api url
  //{
  //		if(resp.ok)
  //		{
  //			console.log('cachefile ok')
  //			resp.json()
  //		}
  //else
  //{
  //	console.warn(`Error response loading ${cachefile}, querying overpass-api instead...`)
  //	fetch(url).then( resp => resp.json() )
  //}
  //	},
  //)
  //.catch(err => {
  //	console.warn(`Network or local error loading ${cachefile}: ${err}, querying overpass-api instead...`)
  //	fetch(url).then(resp => resp.json())
  //})

  .then(json => osmtogeojson(json))
  .then(json => ({
    type: json.type,
    features: json.features.map(feature => {
      return feature.geometry.type === 'Polygon'
        ? Object.assign({}, feature, {geometry: turf.centroid(feature).geometry})
        : feature;
    })
  }));

// Draw lights on map:

let lights = data.then(geojson => {
  console.debug(`lighthousemap: have geojson with ${geojson.features.length} features`);
  return L.indexedGeoJSON(null, {
    pointToLayer: function(feat, latlng) {
      let sequence;

      try {
        sequence = L.Light.sequence(feat.properties.tags, '#FF0');
      } catch (e) {
        console.error('Error parsing sequence: %s', e, feat.properties.tags);

        // Fallback sequence
        sequence = L.Light.sequence({
          'seamark:light:sequence': '1+(1)'
        });
      }

      return new L.Light(latlng, {
        interactive: false,
        title: feat.properties.tags['name'],
        radius: (parseFloat(feat.properties.tags['seamark:light:range'], 10) || 1) * 1000,
        sequence: sequence,
        stroke: false,
        fillOpacity: 0.9,
        fill: !!sequence.state(0),
        fillColor: sequence.state(0)
      });
    }
  }).addTo(map).addData(geojson);
});

let useRealColors = true;

document.querySelector('input[name=real-colors]').checked = useRealColors;

document.querySelector('input[name=real-colors]').addEventListener('change', function(e) {
  useRealColors = this.checked;
});

lights.then(layer => {
  let draw = function(t) {
    layer.eachVisibleLayer(marker => {
      // let state = false
      try{
        let state = marker.options.sequence.state(t);
        marker.setColor(state ? (useRealColors ? state : '#FF0') : false);
      } catch(e){
        // console.error(e)
      }
      
    });
  };

  let update = function(t) {
    draw(t / 1000);
    requestAnimationFrame(update);
  };

  update(0);
}).catch(e => console.error(e));

lights.catch(e => console.error(e));

