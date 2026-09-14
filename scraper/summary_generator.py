import os
import sys
import firebase_admin
from firebase_admin import firestore

def generate_summary():
    try:
        firebase_admin.initialize_app()
        db = firestore.client()
    except Exception as e:
        print(f"Failed to initialize Firebase for summary: {e}")
        sys.exit(1)

    try:
        # Get the most recently updated job
        jobs_ref = db.collection('scraper_jobs')
        query = jobs_ref.order_by('started_at', direction=firestore.Query.DESCENDING).limit(1)
        results = query.stream()

        job_data = None
        job_id = None
        for doc in results:
            job_data = doc.to_dict()
            job_id = doc.id
            break

        if not job_data:
            summary = "## Scraper Run Summary\n\nNo scraper jobs found in Firestore."
        else:
            status = job_data.get('status', 'unknown')
            started_at = job_data.get('started_at')
            ended_at = job_data.get('ended_at')
            error = job_data.get('error')

            metrics = job_data.get('metrics', {})
            discovered = metrics.get('urls_discovered', 0)
            processed = metrics.get('urls_processed', 0)
            failed = metrics.get('urls_failed', 0)

            # Determine emoji status
            if status == 'completed':
                if failed > 0:
                    status_str = "⚠️ Completed with some failures"
                else:
                    status_str = "✅ Completed successfully"
            elif status == 'failed':
                status_str = "❌ Failed"
            else:
                status_str = f"⏳ {status.capitalize()}"

            summary = f"## Scraper Run Summary\n\n"
            summary += f"**Job ID:** `{job_id}`\n"
            summary += f"**Status:** {status_str}\n"

            if started_at:
                summary += f"**Started At:** {started_at.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
            if ended_at:
                summary += f"**Ended At:** {ended_at.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"

            summary += f"\n### Metrics\n"
            summary += f"- **URLs Discovered:** {discovered}\n"
            summary += f"- **URLs Processed:** {processed}\n"
            summary += f"- **URLs Failed:** {failed}\n"

            if error:
                summary += f"\n### Error\n```\n{error}\n```\n"

    except Exception as e:
        summary = f"## Scraper Run Summary\n\n⚠️ Failed to generate summary: {e}"

    print(summary)

    # Append to GITHUB_STEP_SUMMARY if running in GitHub Actions
    summary_file = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_file:
        try:
            with open(summary_file, 'a') as f:
                f.write(summary + '\n')
        except Exception as e:
            print(f"Failed to write to GITHUB_STEP_SUMMARY: {e}")

if __name__ == '__main__':
    generate_summary()
