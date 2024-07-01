const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');

// -------------------------------------------------------------------------------------------------

const app = express();
const port = 8080;

// -------------------------------------------------------------------------------------------------

app.use(express.json());
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  await getSpreadsheetIDs();
});

// -------------------------------------------------------------------------------------------------

app.get('/', async (req, res) => {
  const { sheets } = await getAuthSheets();

  let output = {
    next: `https://${req.hostname}/last`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    items: [],
  };

  for (const spreadsheetID of spreadsheetIDs) {
    const clubs = await setSheet(sheets, spreadsheetID, 'clubs');
    const organizers = await setSheet(sheets, spreadsheetID, 'organizers');
    const locations = await setSheet(sheets, spreadsheetID, 'locations');
    const addresses = await setSheet(sheets, spreadsheetID, 'addresses');
    const images = await setSheet(sheets, spreadsheetID, 'images');
    const amenityFeatures = await setSheet(sheets, spreadsheetID, 'amenity features');

    for (const clubData of clubs.data) {
      const club = setObject(clubs.headers, clubData);
      const codeOrganizersClub = setCodes(club.organizer)[0];
      const rowOrganizersClub = codeOrganizersClub ? organizers.codes.indexOf(codeOrganizersClub) : -1;

      if (rowOrganizersClub != -1) {
        const codesLocationsClub = setCodes(club.location);
        const rowsLocationsClub = codesLocationsClub.map(codeLocationsClub => locations.codes.indexOf(codeLocationsClub)).filter(row => row != -1);

        if (rowsLocationsClub.length > 0) {
          const organizer = setOrganizer(
            rowOrganizersClub,
            organizers,
            images,
            addresses
          );

          if (organizer) {
            for (const rowLocationsClub of rowsLocationsClub) {
              const location = setLocation(
                rowLocationsClub,
                locations,
                images,
                addresses,
                amenityFeatures
              );

              if (location) {
                let itemID = spreadsheetID + '-' + codeOrganizersClub + '-' + locations.codes[rowLocationsClub];
                output.items.push({
                  id: itemID, // string, e.g. '031CLHC23001021'
                  kind: 'Club', // string, e.g. 'FacilityUse'
                  state: 'updated', // string, e.g. 'updated'
                  modified: Date.now(), // string
                  data: {
                    '@context': [
                      'https://openactive.io/',
                      'https://openactive.io/ns-beta',
                    ],
                    '@type': 'Club', // string, e.g. 'FacilityUse'
                    '@id': `https://${req.hostname}/${itemID}`, // string, e.g. 'https://booking.1life.co.uk/OpenActive/api/session-series/031CLHC23001021'
                    identifier: itemID, // string, e.g. '031CLHC23001021', same as parent level 'id'
                    name: '', // string, e.g. 'Junior Gym'
                    organizer: organizer, // Organization
                    location: location, // Place
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  res.send(output);
});

// -------------------------------------------------------------------------------------------------

app.get('/last', async (req, res) => {
  let output = {
    next: `https://${req.hostname}/last`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    items: [],
  };

  res.send(output);
});

// -------------------------------------------------------------------------------------------------

let spreadsheetIDs = [];
async function getSpreadsheetIDs() {
  const rl = await readline.createInterface({
    input: fs.createReadStream(process.env.RELATIVE_FILEPATH_SPREADSHEET_IDS),
  });
  rl.on('line', (line) => {
    spreadsheetIDs.push(line);
  });
}

// -------------------------------------------------------------------------------------------------

async function getAuthSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.RELATIVE_FILEPATH_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({
    version: 'v4',
    auth: authClient,
  });
  return {
    auth,
    authClient,
    sheets,
  };
}

// -------------------------------------------------------------------------------------------------

async function setSheet(sheets, spreadsheetID, name) {
  const numHeaderCols = 1; // Not including the 'code' column
  const numHeaderRows = 4;
  const sheet = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetID,
    range: name,
  });
  return {
    headers: sheet.data.values[0].slice(numHeaderCols + 1),
    codes: sheet.data.values.slice(numHeaderRows).map(row => setCodes(row.slice(numHeaderCols)[0])[0]),
    data: sheet.data.values.slice(numHeaderRows).map(row => row.slice(numHeaderCols + 1)),
  };
}

// -------------------------------------------------------------------------------------------------

function setCodes(codes) {
  return String(codes).split(',').map(code => code.trim()).filter(code => code);
}

// -------------------------------------------------------------------------------------------------

function setObject(keys, values) {
  let object = Object.fromEntries(keys.map((_, i) => [keys[i], values[i]]));
  Object.keys(object).forEach(key => {if (!object[key]) {delete object[key]}});
  return Object.keys(object).length > 0 ? object : null;
}

// -------------------------------------------------------------------------------------------------

// PostalAddress
// https://developer.openactive.io/data-model/types/postaladdress
//   '@type' // Required, string, 'PostalAddress'
//   'streetAddress' // Required, string, e.g. '123 The Street'
//   'addressLocality' // Required, string, e.g. 'Speedham'
//   'addressRegion' // Required, string, e.g. 'London'
//   'addressCountry' // Required, string, e.g. 'GB'
//   'postalCode' // Required, string, e.g. 'SP1 2AB'

// GeoCoordinates
// https://developer.openactive.io/data-model/types/geocoordinates
// Actually integrated into PostalAddress for this project
//   '@type' // Required, string, 'GeoCoordinates'
//   'latitude' // Required, number, e.g. 52.1
//   'longitude' // Required, number, e.g. -0.7

// LocationFeatureSpecification
// https://developer.openactive.io/data-model/types/locationfeaturespecification
//   '@type' // Required, string, 'LocationFeatureSpecification' ... in the actual type page (https://developer.openactive.io/data-model/types/locationfeaturespecification) this is so, but in other examples (https://developer.openactive.io/data-model/types/place) we have e.g. 'ChangingFacilities'
//   'name' // Required, string, e.g. 'Changing Facilities'
//   'value' // Required, boolean, e.g. true

// ImageObject
// https://developer.openactive.io/data-model/types/imageobject
//   '@type' // Required, string, 'ImageObject'
//   'url' // Required, string, e.g. 'http://example.com/static/image/speedball_large.jpg'
//   'width' // Optional, integer, e.g. 500
//   'height' // Optional, integer, e.g. 300
// Not yet included in this project:
//   'thumbnail' // Optional, [ImageObject]

function setProperty(sheet, codesToFind, objectType, outputType) {

  let items = [];

  for (const codeToFind of codesToFind) {
    const row = sheet.codes.indexOf(codeToFind);
    if (row != -1) {
      let item = setObject(sheet.headers, sheet.data[row]);
      if (item) {
        if (objectType == 'LocationFeatureSpecification') {
          Object.assign(item, {'value': true})
        }
        items.push(Object.assign({'@type': objectType}, item));
      }
    }
  }

  if (items.length == 0) {
    return null;
  }
  else if (outputType == 'object') {
    return items[0];
  }
  else if (outputType == 'array') {
    return items;
  }
  else {
    return null;
  }

}

// -------------------------------------------------------------------------------------------------

// Organization
// https://developer.openactive.io/data-model/types/organization
//   '@type' // Optional, string, 'Organization' ... surprising this isn't required???
//   '@id' // Optional, string, e.g. 'https://id.bookingsystem.example.com/organizers/1' ... why is this recommended for Place but optional for Organization???
//   'identifier' // Optional, string, e.g. 'SB1234'
//   'name' // Required, string, e.g. 'Central Speedball Association'
//   'legalName' // Optional, string, e.g. 'Central Speedball Ltd'
//   'description' // Optional, string, e.g. 'The national governing body of speedball'
//   'telephone' // Recommended, string, e.g. '01234 567890'
//   'email' // Optional, string, e.g. 'info@example.com'
//   'url' // Recommended, string, e.g. 'http://speedball.example.com'
//   'sameAs' // Recommended, [string], e.g. ['https://www.facebook.com/examplespeedball/', 'https://twitter.com/examplespeedball']
//   'logo' // Optional, ImageObject, see https://developer.openactive.io/data-model/types/imageobject
//   'address' // Optional, PostalAddress, see https://developer.openactive.io/data-model/types/postaladdress
// Not yet included in this project:
//   'termsOfService' // Optional, [Terms], see https://developer.openactive.io/data-model/types/terms
//   'taxMode' // Optional, TaxMode, see https://openactive.io/TaxMode ... doesn't seem to exist as of 2023/11/09
//   'vatID' // Optional, string
//   'isOpenBookingAllowed' // Optional, boolean, e.g. true
//   'hasAccount' // Optional, CustomerAccount or @id, see https://developer.openactive.io/data-model/types/customeraccount
//   'beta:video' // Optional, [VideoObject], see https://schema.org/VideoObject
//   'beta:formattedDescription' // Optional, string, HTML
//   'beta:formalCriteriaMet' // Optional, [string], URLs

function setOrganizer(rowOrganizersClub, organizers, images, addresses) {

  let organizer = setObject(
    organizers.headers,
    organizers.data[rowOrganizersClub]
  );

  if (organizer) {
    for (const key of Object.keys(organizer)) {
      if (!String(organizer[key]).replaceAll(',','').trim()) {
        delete organizer[key];
      }
      else if (key == 'sameAs') {
        organizer.sameAs = String(organizer.sameAs).split(',').map(url => url.trim()).filter(url => url);
      }
      else if (key == 'logo') {
        const codesImagesOrganizer = setCodes(organizer.logo);
        organizer.logo = codesImagesOrganizer.length > 0 ? setProperty(images, [codesImagesOrganizer[0]], 'ImageObject', 'object') : null;
        if (!organizer.logo) {
          delete organizer.logo;
        }
      }
      else if (key == 'address') {
        const codesAddressesOrganizer = setCodes(organizer.address);
        organizer.address = codesAddressesOrganizer.length > 0 ? setProperty(addresses, [codesAddressesOrganizer[0]], 'PostalAddress', 'object') : null;
        if (!organizer.address) {
          delete organizer.address;
        }
        else {
          delete organizer.address.latitude;
          delete organizer.address.longitude;
          if (Object.keys(organizer.address).length == 0) {
            delete organizer.address;
          }
        }
      }
    }
  }

  if (!organizer || Object.keys(organizer).length == 0) {
    return null;
  }
  else {
    return Object.assign({'@type': 'Organization'}, organizer);
  }

}

// -------------------------------------------------------------------------------------------------

// Place
// https://developer.openactive.io/data-model/types/place
//   '@type' // Required, string, 'Place'
//   '@id' // Recommended, string, e.g. 'https://id.bookingsystem.example.com/places/12345' ... why is this recommended for Place but optional for Organization???
//   'identifier' // Optional, string, e.g. 'SB1234'
//   'name' // Required, string, e.g. 'The Speedball Centre'
//   'description' // Recommended, string, e.g. 'The premiere national speedball location'
//   'telephone' // Recommended, string, e.g. '01234 567890'
//   'email' // Optional, string, e.g. 'info@example.com'
//   'url' // Recommended, string, e.g. 'http://speedball.example.com/the-speedball-centre/'
//   'image' // Recommended, [ImageObject], see https://developer.openactive.io/data-model/types/imageobject
//   'address' // Recommended, PostalAddress, see https://developer.openactive.io/data-model/types/postaladdress
//   'geo' // Recommended, GeoCoordinates, see https://developer.openactive.io/data-model/types/geocoordinates. Absorbed into the 'address' property in the spreadsheet.
//   'amenityFeature' // Recommended, [LocationFeatureSpecification], see https://developer.openactive.io/data-model/types/locationfeaturespecification
// Not yet included in this project:
//   'openingHoursSpecification' // Recommended, [OpeningHoursSpecification], see https://developer.openactive.io/data-model/types/openinghoursspecification
//   'specialOpeningHoursSpecification' // Optional, [OpeningHoursSpecification], see https://developer.openactive.io/data-model/types/openinghoursspecification
//   'containedInPlace' // Optional, Place or @id
//   'containsPlace' // Optional, [Place]
//   'beta:video' // Optional, [VideoObject], see https://schema.org/VideoObject
//   'beta:formattedDescription' // Optional, string, HTML
//   'beta:placeType' // Optional, [Concept], see https://www.w3.org/2009/08/skos-reference/skos.html#Concept
//   'beta:serviceOperator' // Optional, Organization, could be different to the organising Organization

function setLocation(rowLocationsClub, locations, images, addresses, amenityFeatures) {

  let location = setObject(
    locations.headers,
    locations.data[rowLocationsClub]
  );

  if (location) {
    for (const key of Object.keys(location)) {
      if (!String(location[key]).replaceAll(',','').trim()) {
        delete location[key];
      }
      else if (key == 'image') {
        const codesImagesLocation = setCodes(location.image);
        location.image = codesImagesLocation.length > 0 ? setProperty(images, codesImagesLocation, 'ImageObject', 'array') : null;
        if (!location.image) {
          delete location.image;
        }
      }
      else if (key == 'address') {
        const codesAddressesLocation = setCodes(location.address);
        location.address = codesAddressesLocation.length > 0 ? setProperty(addresses, [codesAddressesLocation[0]], 'PostalAddress', 'object') : null;
        if (!location.address) {
          delete location.address;
        }
        else {
          if (['latitude', 'longitude'].some(i => Object.keys(location.address).includes(i))) {
            location.geo = {
              '@type': 'GeoCoordinates',
            }
            if (Object.keys(location.address).includes('latitude')) {
              location.geo.latitude = Number(location.address.latitude);
              delete location.address.latitude;
            }
            if (Object.keys(location.address).includes('longitude')) {
              location.geo.longitude = Number(location.address.longitude);
              delete location.address.longitude;
            }
          }
          if (Object.keys(location.address).length == 0) {
            delete location.address;
          }
        }
      }
      else if (key == 'amenityFeature') {
        const codesAmenityFeaturesLocation = setCodes(location.amenityFeature);
        location.amenityFeature = codesAmenityFeaturesLocation.length > 0 ? setProperty(amenityFeatures, codesAmenityFeaturesLocation, 'LocationFeatureSpecification', 'array') : null;
        if (!location.amenityFeature) {
          delete location.amenityFeature;
        }
      }
    }
  }

  if (!location || Object.keys(location).length == 0) {
    return null;
  }
  else {
    return Object.assign({'@type': 'Place'}, location);
  }

}
