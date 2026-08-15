import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { normalizePhoneForComparison } from './utilities';

export interface ImportedContact {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface ImportedCalendarEvent {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  is_recurring: boolean;
  recurring_event_id?: string;
}

export const requestContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

export const getContacts = async (): Promise<ImportedContact[]> => {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) {
    throw new Error('Contacts permission not granted');
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.Emails,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Addresses,
    ],
  });

  return data.map((contact) => ({
    name: contact.name || '',
    email: contact.emails?.[0]?.email || '',
    phone: contact.phoneNumbers?.[0]?.number || '',
    address: contact.addresses?.[0]
      ? `${contact.addresses[0].street || ''}, ${contact.addresses[0].city || ''}, ${contact.addresses[0].region || ''}`
      : '',
  })).filter((c) => c.name);
};

export const importContactsAsClients = async (
  contacts: ImportedContact[],
  userId: string
): Promise<{ success: number; failed: number; skipped: number }> => {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name, phone, address')
    .eq('user_id', userId);

  const existingNames = new Set(
    (existingClients || []).map(c => c.name?.trim().toLowerCase()).filter(Boolean)
  );
  const existingPhones = new Set(
    (existingClients || [])
      .map(c => normalizePhoneForComparison(c.phone || ''))
      .filter(p => p.length >= 7)
  );

  for (const contact of contacts) {
    try {
      const contactName = contact.name.trim().toLowerCase();
      const contactPhone = normalizePhoneForComparison(contact.phone || '');

      if (existingNames.has(contactName)) {
        skipped++;
        continue;
      }

      if (contactPhone.length >= 7 && existingPhones.has(contactPhone)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('clients').insert({
        user_id: userId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        notes: 'Imported from contacts',
      });

      if (error) {
        failed++;
      } else {
        success++;
        existingNames.add(contactName);
        if (contactPhone.length >= 7) existingPhones.add(contactPhone);
      }
    } catch {
      failed++;
    }
  }

  return { success, failed, skipped };
};

export const fetchGoogleCalendarEvents = async (
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<ImportedCalendarEvent[]> => {
  const now = new Date();
  const defaultTimeMin = timeMin || now.toISOString();
  const defaultTimeMax = timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const allEvents: ImportedCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();

    for (const item of data.items || []) {
      const startDateTime = item.start?.dateTime || item.start?.date;
      const endDateTime = item.end?.dateTime || item.end?.date;

      if (startDateTime && endDateTime) {
        allEvents.push({
          title: item.summary || 'Untitled Event',
          description: item.description || '',
          start_time: startDateTime,
          end_time: endDateTime,
          location: item.location || '',
          is_recurring: !!item.recurringEventId,
          recurring_event_id: item.recurringEventId,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
};

export const importCalendarEventsAsSchedule = async (
  events: ImportedCalendarEvent[],
  userId: string
): Promise<{ success: number; failed: number; recurring: number }> => {
  let success = 0;
  let failed = 0;
  let recurring = 0;

  for (const event of events) {
    try {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);

      const { data: existing } = await supabase
        .from('schedule_events')
        .select('id')
        .eq('user_id', userId)
        .eq('title', event.title)
        .eq('start_time', startTime.toISOString())
        .maybeSingle();

      if (existing) {
        continue;
      }

      const insertData: Record<string, unknown> = {
        user_id: userId,
        title: event.title,
        description: event.description + '\n\n(Imported from Google Calendar)',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: event.location,
      };

      if (event.is_recurring) {
        insertData.is_recurring = true;
        insertData.recurrence_type = 'custom';
        recurring++;
      }

      const { error } = await supabase.from('schedule_events').insert(insertData);

      if (error) {
        failed++;
      } else {
        success++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed, recurring };
};

export const fetchGoogleContacts = async (accessToken: string): Promise<ImportedContact[]> => {
  const response = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,addresses&pageSize=100',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Google contacts');
  }

  const data = await response.json();
  const contacts: ImportedContact[] = [];

  for (const person of data.connections || []) {
    const name = person.names?.[0]?.displayName;
    if (!name) continue;

    const email = person.emailAddresses?.[0]?.value || '';
    const phone = person.phoneNumbers?.[0]?.value || '';
    const address = person.addresses?.[0]
      ? `${person.addresses[0].streetAddress || ''}, ${person.addresses[0].city || ''}, ${person.addresses[0].region || ''}`
      : '';

    contacts.push({ name, email, phone, address });
  }

  return contacts;
};
