import os
import sys

# Ensure local imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

def main():
    print("Initializing Firebase Admin SDK...")

    try:
        # Initialize Firebase Admin using Application Default Credentials (ADC)
        firebase_admin.initialize_app()
        db = firestore.client()
        print("Firebase initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize Firebase: {e}")
        sys.exit(1)

    print("Querying for projects with resolution_state == 'staged'...")
    # Query the projects collection
    projects_ref = db.collection('projects')
    staged_query = projects_ref.where("resolution_state", "==", "staged")

    # We use stream() to iterate through documents
    staged_docs = list(staged_query.stream())
    total_staged = len(staged_docs)
    print(f"Found {total_staged} projects in 'staged' state.")

    if total_staged == 0:
        print("No staged projects found. Exiting.")
        return

    # Perform a bulk update using batches
    batch = db.batch()
    updated_count = 0

    for doc in staged_docs:
        batch.update(doc.reference, {"resolution_state": "active"})
        updated_count += 1

        # Firestore batches have a limit of 500 operations
        if updated_count % 500 == 0:
            batch.commit()
            batch = db.batch()

    # Commit any remaining operations
    if updated_count % 500 != 0:
        batch.commit()

    # Log the total number of projects restored
    print(f"Successfully restored {updated_count} projects back to 'active'.")

if __name__ == "__main__":
    main()
