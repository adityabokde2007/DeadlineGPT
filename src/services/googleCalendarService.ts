export async function addEventToGoogleCalendar(
  accessToken: string,
  eventData: { title: string; date: string; startTime: string; endTime: string; description?: string }
) {
  try {
    const { title, date, startTime, endTime, description } = eventData;
    
    // Parse time to ISO format (assume local time for simplicity or construct properly)
    // Date: YYYY-MM-DD
    // Start Time: HH:MM
    
    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description: description || "Scheduled via DeadlineGPT",
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Calendar API error:", errText);
      let errMsg = response.statusText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errMsg = parsed.error.message;
        }
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to add event to Google Calendar", error);
    throw error;
  }
}

export async function deleteEventFromGoogleCalendar(
  accessToken: string,
  eventId: string
) {
  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Event ${eventId} not found on Google Calendar, might have been already deleted.`);
        return; // gracefully handle 404
      }
      const errText = await response.text();
      console.error("Google Calendar API error on delete:", errText);
      throw new Error(response.statusText);
    }
  } catch (error) {
    console.error("Failed to delete event from Google Calendar", error);
    // Don't throw, just log to prevent app crash as per requirements
  }
}
