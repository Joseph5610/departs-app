# Data sources and licences

The code is under the [MIT License](https://github.com/Joseph5610/departs-app/blob/master/LICENSE). The transit data it shows keeps each source's own terms.

| Region | Source (credit) | Licence |
| --- | --- | --- |
| Prague | [PID open data](https://pid.cz/o-systemu/opendata/) and PID realtime data via [Golemio](https://golemio.cz) (ROPID, Operátor ICT) | CC BY 4.0 |
| Brno | [IDS JMK GTFS and GTFS-RT](https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328), [vehicle positions](https://data.brno.cz/datasets/e8aa121910df41bb9a28e4ca34a263c7) (Statutární město Brno, KORDIS JMK) | CC BY 4.0 |
| Brno | [IDS JMK – výluky a odklony](https://data.brno.cz/datasets/227c819ed9fc4d2e8498e9ea9c93c965) (KORDIS JMK, Statutární město Brno) | Open data, no licence named by the publisher |
| Brno | Route shapes from the Lissy API (FIT VUT Brno); the [Lissy](https://github.com/Jorgen98/Lissy) tool itself is GPL-3.0 | Used with the author's explicit permission |
| Prešov | [GTFS – MHD Prešov](https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079) and [on-line vehicle positions](https://egov.presov.sk/geodatakatalog/) (Dopravný podnik mesta Prešov, a.s.) | CC BY 4.0 |
| Ústecký kraj | [Ústecký kraj open data (Portabo)](https://lkod.portabo.cz/datasets) and [CIS JŘ timetables](https://data.gov.cz/datová-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F66003008%2F1463646434) (Ministerstvo dopravy ČR) | Czech open data without copyright or database rights |
| Ústecký kraj | Train timetables from [Spojenka – Data jízdních řádů](https://www.spojenka.cz/jrdata) (GTFS) | Free for non-commercial use only, as its publisher states |
| All | Map data and place search: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), CARTO basemaps, Photon by komoot | ODbL 1.0 |

departs.app changes this data before showing it: timetables are converted, filtered and matched to stops and platforms, and combined with the live feeds. The processed static data, with the changes made to each source, is published in [departs-data](https://github.com/Joseph5610/departs-data#-license) under CC BY 4.0. The providers do not endorse departs.app. The app credits every source, its licence and these changes in Settings → Data sources & licences.

## Live feeds by network

| Network | Realtime source | Fetched by |
| ------- | --------------- | ---------- |
| Prague (PID) | [Golemio API](https://api.golemio.cz/) (needs an API key) | Pages Functions |
| Brno (IDS JMK) | KORDIS GTFS-RT; the daily gis.brno.cz diversions layer (alert dates, upcoming closures); the gis.brno.cz vehicle stream | Pages Functions; the browser (vehicle stream) |
| Prešov (DPMP) | DPMP on-line vehicle positions (CSV) | Pages Functions |
| Ústecký kraj (DÚK) | Portabo departure boards and vehicle positions | Pages Functions |

Static timetables, stops and route shapes for every network come from [departs-data](https://github.com/Joseph5610/departs-data), rebuilt daily.
