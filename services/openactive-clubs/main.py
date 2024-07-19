import json
from flask import Flask, request
from os import environ, getenv

# --------------------------------------------------------------------------------------------------

app = Flask(__name__)

# --------------------------------------------------------------------------------------------------

# These folders must have been made via the Google Cloud browser console under Cloud Storage for this
# project, and the volume must have been mounted via the terminal at the mount-path '/volume-1'. With
# this service called 'openactive-clubs', this was done as follows (note that the volume and its mount-path
# were given the same name, which didn't have to be so):
#   $ gcloud beta run services update openactive-clubs \
#   --region europe-west2 \
#   --add-volume name=volume-1,type=cloud-storage,bucket=openactive-clubs_cloudbuild \
#   --add-volume-mount volume=volume-1,mount-path=/volume-1
RELATIVE_FILEPATH_OPPORTUNITIES = getenv('RELATIVE_FILEPATH_OPPORTUNITIES')

FILENAME_OPPORTUNITIES = getenv('FILENAME_OPPORTUNITIES')

# --------------------------------------------------------------------------------------------------

@app.route('/')
def main():
    opportunities = []

    try:
        with open(RELATIVE_FILEPATH_OPPORTUNITIES + '/' + FILENAME_OPPORTUNITIES, 'r') as file_in:
            opportunities = json.load(file_in)
    except:
        pass

    return {
        'next': f'{request.url_root}last',
        'license': 'https://creativecommons.org/licenses/by/4.0/',
        'items': opportunities,
    }

# --------------------------------------------------------------------------------------------------

@app.route('/last')
def last():
    return {
        'next': f'{request.url_root}last',
        'license': 'https://creativecommons.org/licenses/by/4.0/',
        'items': [],
    }

# --------------------------------------------------------------------------------------------------

if (__name__ == '__main__'):
    app.run(
        debug=True,
        host='0.0.0.0',
        port=int(environ.get('PORT', 8080)),
    )