const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');

// -------------------------------------------------------------------------------------------------

const app = express();
const port = 8080;

const numHeaderRows = 3;
const numHeaderCols = 1;

// -------------------------------------------------------------------------------------------------

app.use(express.json());
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  await getSpreadsheetIds();
});

// -------------------------------------------------------------------------------------------------

app.get('/clubs', async (req, res) => {
  const { sheets } = await getAuthSheets();

  let output = {
    next: '',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    items: [],
  };

  for (const spreadsheetId of spreadsheetIds) {

    let clubs = {
      sheet: await setSheet(sheets, spreadsheetId, 'clubs'),
    };
    let organizers = {
      sheet: await setSheet(sheets, spreadsheetId, 'organizers'),
    };
    organizers.codes = setCodesSheet(organizers.sheet);
    let locations = {
      sheet: await setSheet(sheets, spreadsheetId, 'locations'),
    };
    locations.codes = setCodesSheet(locations.sheet);
    let addresses = {
      sheet: await setSheet(sheets, spreadsheetId, 'addresses'),
    };
    addresses.codes = setCodesSheet(addresses.sheet);
    let images = {
      sheet: await setSheet(sheets, spreadsheetId, 'images'),
    };
    images.codes = setCodesSheet(images.sheet);
    let amenityFeatures = {
      sheet: await setSheet(sheets, spreadsheetId, 'amenity features'),
    };
    amenityFeatures.codes = setCodesSheet(amenityFeatures.sheet);

    for (const club of clubs.sheet.slice(numHeaderRows)) {
      const codeOrganizersClub = setCodesCell(club[0])[0];
      const rowOrganizersClub = codeOrganizersClub ? organizers.codes.indexOf(codeOrganizersClub) : -1;

      if (rowOrganizersClub != -1) {
        const codesLocationsClub = setCodesCell(club[1]);
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
                output.items.push({
                  id: '', // string, e.g. '031CLHC23001021'
                  kind: 'FacilityUse', // string, e.g. 'FacilityUse'
                  state: 'updated', // string, e.g. 'updated'
                  modified: '', // string
                  data: {
                    '@context': [
                      'https://openactive.io/',
                      'https://openactive.io/ns-beta',
                    ],
                    id: '', // string, e.g. 'https://booking.1life.co.uk/OpenActive/api/session-series/031CLHC23001021'
                    identifier: '', // string, e.g. '031CLHC23001021', same as parent level 'id'
                    type: 'FacilityUse', // string, e.g. 'FacilityUse'
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

let spreadsheetIds = [];
async function getSpreadsheetIds() {
  const rl = await readline.createInterface({
    input: fs.createReadStream('spreadsheetIds.txt'),
  });
  rl.on('line', (line) => {
    spreadsheetIds.push(line);
  });
}

// -------------------------------------------------------------------------------------------------

async function getAuthSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'key.json',
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

async function setSheet(sheets, spreadsheetId, name) {
  const sheet = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: name,
  });
  return sheet.data.values;
}

// -------------------------------------------------------------------------------------------------

function setCodesSheet(sheet) {
  return sheet.slice(numHeaderRows).map(row => setCodesCell(row[0])[0]);
}

// -------------------------------------------------------------------------------------------------

function setCodesCell(cell) {
  return String(cell).split(',').map(code => code.trim()).filter(code => code);
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

function setProperty(sheet, codes, codesToFind, objectType, outputType) {

  let items = [];

  for (const codeToFind of codesToFind) {
    const row = codes.indexOf(codeToFind);
    if (row != -1) {
      let item = setObject(
        sheet[0].slice(numHeaderCols),
        sheet[numHeaderRows + row].slice(numHeaderCols)
      );
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
    organizers.sheet[0].slice(numHeaderCols),
    organizers.sheet[numHeaderRows + rowOrganizersClub].slice(numHeaderCols)
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
        const codesImagesOrganizer = setCodesCell(organizer.logo);
        organizer.logo = codesImagesOrganizer.length > 0 ? setProperty(images.sheet, images.codes, [codesImagesOrganizer[0]], 'ImageObject', 'object') : null;
        if (!organizer.logo) {
          delete organizer.logo;
        }
      }
      else if (key == 'address') {
        const codesAddressesOrganizer = setCodesCell(organizer.address);
        organizer.address = codesAddressesOrganizer.length > 0 ? setProperty(addresses.sheet, addresses.codes, [codesAddressesOrganizer[0]], 'PostalAddress', 'object') : null;
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
    locations.sheet[0].slice(numHeaderCols),
    locations.sheet[numHeaderRows + rowLocationsClub].slice(numHeaderCols)
  );

  if (location) {
    for (const key of Object.keys(location)) {
      if (!String(location[key]).replaceAll(',','').trim()) {
        delete location[key];
      }
      else if (key == 'image') {
        const codesImagesLocation = setCodesCell(location.image);
        location.image = codesImagesLocation.length > 0 ? setProperty(images.sheet, images.codes, codesImagesLocation, 'ImageObject', 'array') : null;
        if (!location.image) {
          delete location.image;
        }
      }
      else if (key == 'address') {
        const codesAddressesLocation = setCodesCell(location.address);
        location.address = codesAddressesLocation.length > 0 ? setProperty(addresses.sheet, addresses.codes, [codesAddressesLocation[0]], 'PostalAddress', 'object') : null;
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
        const codesAmenityFeaturesLocation = setCodesCell(location.amenityFeature);
        location.amenityFeature = codesAmenityFeaturesLocation.length > 0 ? setProperty(amenityFeatures.sheet, amenityFeatures.codes, codesAmenityFeaturesLocation, 'LocationFeatureSpecification', 'array') : null;
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
