# SlateLane Dispatch CRM Architecture

Last Updated: 2026-07-02

---

# Overview

SlateLane Dispatch CRM is a production-oriented freight dispatch management platform.

The application consists of two major areas:

1. Public Website
2. Admin CRM

The public website is responsible for marketing and lead generation.

The Admin CRM is responsible for managing leads, carriers, dispatch operations, and FMCSA data.

---

# Technology Stack

Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

Backend

- Supabase
- Resend

Future Integrations

- Official FMCSA Import
- Scheduled Jobs
- Authentication
- Role-Based Access Control

---

# High-Level Structure

src/

    app/
        admin/
        api/
        website pages

    components/

    lib/
        supabase/
        fmcsa/

    styles/

---

# Public Area

Responsibilities

- Marketing
- Company information
- Contact form
- Lead generation

Current Status

✅ Completed

---

# Admin Area

Current Routes

/admin/dashboard

/admin/leads

/admin/carriers

/admin/settings

Responsibilities

- Dashboard
- Lead management
- Carrier management
- Settings
- Reporting

Current Status

🟨 Foundation completed

---

# API Layer

Current

Contact Form

Future

FMCSA Import

Dashboard APIs

Authentication APIs

Activity APIs

---

# Data Flow

Visitor

↓

Website

↓

Contact Form

↓

Resend

↓

Supabase

↓

Admin Dashboard

---

# Planned CRM Modules

Dashboard

Leads

Carriers

Carrier Contacts

Notes

Activities

Follow Ups

Reporting

Users

Roles

Importer

---

# Current Folder Responsibilities

app/

Application routes

components/

Reusable UI components

lib/

Business logic

lib/fmcsa/

FMCSA-related logic

lib/supabase/

Supabase utilities

docs/

Project documentation

---

# Coding Standards

- TypeScript only
- Reusable components
- Server-side data where appropriate
- Production-ready architecture
- No duplicated business logic
- Documentation updated after every completed feature

---

# Architecture Status

Public Website

✅ Complete

Admin Foundation

✅ Complete

CRM Modules

⬜ Not Started

Importer

⬜ Not Started

Automation

⬜ Not Started

Deployment

⬜ Not Started