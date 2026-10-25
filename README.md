# Chou Farm Limited website

Fresh Produce. Premium Quality.

A website and farm management dashboard for Chou Farm Limited, built with plain
HTML, CSS and JavaScript, and Supabase for the database, sign-in and file storage.

## What lives where

- Code: this repository (written in Spck Editor, stored on GitHub)
- Public website: the host (Cloudflare Pages or GitHub Pages)
- Backend: Supabase (database, sign-in, file storage)
- Records (crops, products and so on): the Supabase PostgreSQL database
- Uploaded photos and documents: Supabase Storage

## Folders

- css/ and js/ : the styles and scripts
- sql/ : the database scripts, numbered in the order they are run
- assets/ : fixed images

## Setting up from nothing

1. Create a Supabase project.
2. In the SQL Editor, run the scripts in the sql folder in this order:
   01a, 01b, 01c, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16.
   Script 16 removes the old enquiry and order tables, because this website
   no longer collects enquiries, orders or payments or stores customer data.
   Read each one first. Run each one once.
3. In Supabase, create the user for the first super administrator (Authentication,
   Users, Add user). Then in the SQL Editor set their role to super_admin and
   is_active to true in the profiles table.
4. In Authentication settings, turn OFF "Allow new users to sign up".
5. Put the project URL and the public (anon or publishable) key in js/config.js.
6. Publish the website files.

Never put the service_role key or any secret key in this repository.

## Roles

- Viewer: reads the dashboard, changes nothing
- Editor: adds and edits content and photos
- Administrator: also deletes and changes company settings
- Super administrator: also manages users

## Backups and recovery

Supabase's free plan does not give downloadable automatic backups. Until you
upgrade, make your own copy regularly (at least once a month, and before big changes):

1. For each table, open Table Editor, tap the table, then the three-dot menu, and
   Export to CSV. The important ones: crops, livestock, products,
   product_categories, news_items, farming_guides, learning_materials, about_content,
   team_members, milestones, core_values, farm_locations, farm_profile, farm_stats,
   site_settings, gallery_items, profiles.
2. Keep the original photos and documents you uploaded on your phone or computer.
3. Store the CSV files somewhere safe, not only on the same phone.

To recover into a new project: do "Setting up from nothing", import the CSV files
with the Table Editor's import tool (parent tables before child tables), and
re-upload the photos and documents through the dashboard.

For a business that depends on this data, upgrade the Supabase project to a paid
plan, which includes daily backups.

## Free plan limits to know about

- A free Supabase project pauses after about a week without activity. While it is
  paused, the website cannot load its data. Open the Supabase dashboard and tap
  Restore to wake it up.
- Storage and bandwidth are limited. Check the usage pages from time to time and
  upgrade before you reach the limits.

## Tests

The test pages (names starting with test-) are only for setup. They must be
deleted before the website goes live.