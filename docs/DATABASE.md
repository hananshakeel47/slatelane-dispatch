# SlateLane Dispatch CRM Database

Last Updated: 2026-07-02

---

# Purpose

This document defines the database architecture for the CRM.

It is divided into two sections:

1. Current Database
2. Target Database

---

# Current Database

Current Status

🟨 Supabase Connected

The current project already communicates with Supabase.

The production CRM schema has NOT been implemented yet.

---

# Target Database

The CRM will use the following primary tables.

## leads

Stores every website inquiry and manually created lead.

Fields

- id
- company_name
- contact_name
- phone
- email
- source
- status
- notes
- created_at

---

## carriers

Stores every approved carrier.

Fields

- id
- mc_number
- dot_number
- company_name
- phone
- email
- city
- state
- safety_rating
- insurance_status
- status
- created_at

---

## carrier_contacts

Stores contacts for each carrier.

Fields

- id
- carrier_id
- name
- title
- phone
- email

---

## notes

Stores notes attached to leads or carriers.

Fields

- id
- user_id
- lead_id
- carrier_id
- content
- created_at

---

## activities

Tracks CRM events.

Examples

- Lead Created
- Carrier Imported
- Note Added
- Status Changed

Fields

- id
- user_id
- entity_type
- entity_id
- action
- created_at

---

## follow_ups

Stores reminders.

Fields

- id
- lead_id
- carrier_id
- assigned_to
- due_date
- completed

---

## users

CRM users.

Fields

- id
- full_name
- email
- role
- active

---

# Relationships

Lead

↓

Follow Up

↓

Activity

Carrier

↓

Carrier Contact

↓

Notes

↓

Activity

---

# Future Tables

Import Jobs

Audit Logs

Notifications

Email Templates

Settings

---

# Database Status

Supabase

✅ Connected

Schema

⬜ Pending

Relationships

⬜ Pending

Indexes

⬜ Pending

Policies

⬜ Pending