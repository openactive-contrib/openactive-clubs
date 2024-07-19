import json
import requests
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.service_account import Credentials
from os import getenv
from re import sub

# --------------------------------------------------------------------------------------------------

# These folders must have been made via the Google Cloud browser console under Cloud Storage for this
# project, and the volume must have been mounted via the terminal at the mount-path '/volume-1'. With
# this job called 'get-opportunities', this was done as follows (note that the volume and its mount-path
# were given the same name, which didn't have to be so):
#   $ gcloud beta run jobs update get-opportunities \
#   --region europe-west2 \
#   --add-volume name=volume-1,type=cloud-storage,bucket=openactive-clubs_cloudbuild \
#   --add-volume-mount volume=volume-1,mount-path=/volume-1
RELATIVE_FILEPATH_KEY = getenv('RELATIVE_FILEPATH_KEY')
RELATIVE_FILEPATH_SPREADSHEET_IDS = getenv('RELATIVE_FILEPATH_SPREADSHEET_IDS')
RELATIVE_FILEPATH_OPPORTUNITIES = getenv('RELATIVE_FILEPATH_OPPORTUNITIES')

FILENAME_KEY = getenv('FILENAME_KEY')
FILENAME_SPREADSHEET_IDS = getenv('FILENAME_SPREADSHEET_IDS')
FILENAME_OPPORTUNITIES = getenv('FILENAME_OPPORTUNITIES')

URL_ID_BASE = 'https://www.openactive.io'

NUM_DECIMAL_PLACES_COORDS = 6

# --------------------------------------------------------------------------------------------------

def clean_string(val):
    if (type(val) == str):
        return val.strip().strip(',').strip() if val else val
    else:
        return ''
# --------------------------------------------------------------------------------------------------

def list_from_string(val, delimiter):
    if (type(val) == str):
        list_out = [clean_string(item) for item in val.split(delimiter)]
        list_out = [item for item in list_out if item]
        return list_out
    else:
        return []

# --------------------------------------------------------------------------------------------------

def main():
    try:
        opportunities = []

        # --------------------------------------------------------------------------------------------------

        r_activities = requests.get('https://openactive.io/activity-list/activity-list.jsonld')
        activities = {activity['prefLabel']: activity['id'] for activity in r_activities.json()['concept']}

        r_accessibilities = requests.get('https://openactive.io/accessibility-support/accessibility-support.jsonld')
        accessibilities = {accessibility['prefLabel']: accessibility['id'] for accessibility in r_accessibilities.json()['concept']}

        service = build('sheets', 'v4', credentials=Credentials.from_service_account_file(RELATIVE_FILEPATH_KEY + '/' + FILENAME_KEY))

        with open(RELATIVE_FILEPATH_SPREADSHEET_IDS + '/' + FILENAME_SPREADSHEET_IDS, 'r') as file_in:
            spreadsheet_ids = [spreadsheet_id.strip().strip(',').strip() for spreadsheet_id in file_in.read().split('\n') if spreadsheet_id]

        # --------------------------------------------------------------------------------------------------

        for spreadsheet_id in spreadsheet_ids:
            spreadsheet = (
                service
                .spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range='Form responses 1')
                .execute()
            )

            values = spreadsheet.get('values', [])

            if (not values):
                print('No data found')
                return

            headers = values[0]

            # --------------------------------------------------------------------------------------------------

            for row in values[1:]:
                club = {key: val for (key, val) in zip(headers, row)}

                if (club.get('Verified', 'no').lower().strip() == 'yes'):
                    timestamp = sub('/|:', ' ', club['Timestamp']).split()
                    item_id = f"{spreadsheet_id}-{timestamp[2]}-{timestamp[1]}-{timestamp[0]}-{timestamp[3]}-{timestamp[4]}-{timestamp[5]}"

                    opportunities.append({
                        'id': item_id,
                        'kind': 'Club',
                        'state': 'updated',
                        'modified': int(f"{timestamp[2]}{timestamp[1]}{timestamp[0]}{timestamp[3]}{timestamp[4]}{timestamp[5]}"),
                        'data': {
                            '@context': [
                                'https://openactive.io/',
                                'https://openactive.io/ns-beta'
                            ],
                            'type': 'Club',
                            '@id': f'{URL_ID_BASE}/{item_id}',
                            'identifier': item_id,
                            'name': clean_string(club.get('Club name')),
                            'description': clean_string(club.get('Club description')),
                            'url': clean_string(club.get('Club main URL')),
                            'image': [
                                {
                                    '@type': 'ImageObject',
                                    'url': image_url,
                                    # 'width': 0,
                                    # 'height': 0,
                                }
                                for image_url in list_from_string(club.get('Club image URLs'), '\n')
                            ],
                            'location': {
                                '@type': 'Place',
                                '@id': f'{URL_ID_BASE}/{item_id}-loc',
                                'identifier': f'{item_id}-loc',
                                'name': clean_string(club.get('Location common name')),
                                'description': clean_string(club.get('Location description')),
                                'telephone': clean_string(club.get('Location telephone')),
                                'email': clean_string(club.get('Location email')),
                                'url': clean_string(club.get('Location main URL')),
                                'image': [
                                    {
                                        '@type': 'ImageObject',
                                        'url': image_url,
                                        # 'width': 0,
                                        # 'height': 0,
                                    }
                                    for image_url in list_from_string(club.get('Location image URLs'), '\n')
                                ],
                                'amenityFeature': [
                                    {
                                        '@type': 'LocationFeatureSpecification',
                                        'name': amenity_feature,
                                        'value': True,
                                    }
                                    for amenity_feature in list_from_string(club.get('Location amenity features'), '\n')
                                ],
                                'address': {
                                    '@type': 'PostalAddress',
                                    'streetAddress': clean_string(club.get('Location street address')),
                                    'addressLocality': clean_string(club.get('Location locality')),
                                    'addressRegion': clean_string(club.get('Location region')),
                                    'addressCountry': 'GB',
                                    'postalCode': clean_string(club.get('Location post code')),
                                },
                                'geo': {
                                    '@type': 'GeoCoordinates',
                                    'latitude': round(float(club.get('Location latitude')), NUM_DECIMAL_PLACES_COORDS) if club.get('Location latitude') else None,
                                    'longitude': round(float(club.get('Location longitude')), NUM_DECIMAL_PLACES_COORDS) if club.get('Location longitude') else None,
                                },
                            },
                            'organizer': {
                                '@type': 'Organization',
                                '@id': f'{URL_ID_BASE}/{item_id}-org',
                                'identifier': f'{item_id}-org',
                                'name': clean_string(club.get('Organiser common name')),
                                'legalName': clean_string(club.get('Organiser legal name')),
                                'description': clean_string(club.get('Organiser description')),
                                'telephone': clean_string(club.get('Organiser telephone')),
                                'email': clean_string(club.get('Organiser email')),
                                'url': clean_string(club.get('Organiser main URL')),
                                'sameAs': list_from_string(club.get('Organiser social media URLs'), '\n'),
                                'logo': {
                                    '@type': 'ImageObject',
                                    'url': clean_string(club.get('Organiser logo URL')),
                                    # 'width': 0,
                                    # 'height': 0,
                                } if clean_string(club.get('Organiser logo URL')) else {},
                                'address': {
                                    '@type': 'PostalAddress',
                                    'streetAddress': clean_string(club.get('Location street address')),
                                    'addressLocality': clean_string(club.get('Location locality')),
                                    'addressRegion': clean_string(club.get('Location region')),
                                    'addressCountry': 'GB',
                                    'postalCode': clean_string(club.get('Location post code')),
                                } if (club.get('Is the club organiser address the same as the club location address that you previously entered?', 'no').lower().strip() == 'yes') else {
                                    '@type': 'PostalAddress',
                                    'streetAddress': clean_string(club.get('Organiser street address')),
                                    'addressLocality': clean_string(club.get('Organiser locality')),
                                    'addressRegion': clean_string(club.get('Organiser region')),
                                    'addressCountry': 'GB',
                                    'postalCode': clean_string(club.get('Organiser post code')),
                                },
                            },
                            'activity': [
                                {
                                    '@type': 'Concept',
                                    '@id': activities[preflabel],
                                    'prefLabel': preflabel,
                                    'inScheme': 'https://openactive.io/activity-list'
                                }
                                for preflabel in list_from_string(club.get('Activity options'), ',')
                            ],
                            'accessibilityInformation': clean_string(club.get('Accessibility description')),
                            'accessibilitySupport': [
                                {
                                    'type': 'Concept', # Unlike 'activity', this does not use '@type', is this okay?
                                    'id': accessibilities[preflabel], # Unlike 'activity', this does not use '@id', is this okay?
                                    'prefLabel': preflabel,
                                    'inScheme': 'https://openactive.io/accessibility-support'
                                }
                                for preflabel in list_from_string(club.get('Accessibility support'), ',')
                            ],
                        }
                    })

        # --------------------------------------------------------------------------------------------------

        with open(RELATIVE_FILEPATH_OPPORTUNITIES + '/' + FILENAME_OPPORTUNITIES, 'w') as file_out:
            json.dump(opportunities, file_out)

    except HttpError as error:
        print(error)

# --------------------------------------------------------------------------------------------------

if (__name__ == '__main__'):
    main()