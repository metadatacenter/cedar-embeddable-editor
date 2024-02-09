# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-02-08

This version contains only fixes and non-breaking changes related to the language map handling for the UI.

However, there was a new feature introduced in 1.0.14 - the data quality report. Because of this, we are changing the minor version number.

### Added
- `CustomEvent` with `type`:`'change'` is emitted when a multi instance operation is performed (add, copy, delete)

### Fixed
- Load built-in `en` language map if nothing is specified in the config

### Changed
- Better language map related logging
- If no external or internal language map can be found based on the config, still use the built-in `en` map
- Allow uppercase in domain names of Link components

## [1.0.16] - 2024-02-07

### Added
- Language map loading configuration option `languageMapPathPrefix` + docs

### Fixed
- Data Quality Report in case of mandatory fields with 0..n cardinality
- Fixed bug regarding required value of multi-instance fields

## [1.0.15] - 2024-02-05

### Added
- Added naive throttling prevention to the `/integrated-search` calls (random delay < 2000 ms)
- Added validation error message for links

### Fixed
- Fixed null reference in Data Quality Report builder
- Fixed required symbol for multi instance fields

## [1.0.14] - 2024-01-26

### Added

- Data Quality Report feature.

## [1.0.13] - 2024-01-25

### Added

- showAllMultiInstanceValues flag is added.
  Now it's possible to hide "All Values" section of multi instance fields by adding showAllMultiInstanceValues : false to config.


## [1.0.12] - 2024-01-19

### Changed

- Allow empty string value representing an empty attribute-value field

## [1.0.11] - 2024-01-18

### Changed

- Material Icons and Roboto font embedded in package

## [1.0.10] - 2024-01-11

### Added
- A randomly generated UUID together with the trailing path is assigned as to @id is to nested element instances for model validation

## [1.0.9] - UNPUBLISHED

## [1.0.8] - 2023-11-20

### Changed
- Added some error-tolerance to instances that don't align with the template

## [1.0.7] - 2023-11-20

### Fixed
- Fixed null reference

### Changed
- Language map loading logging

## [1.0.6] - 2023-11-17

### Fixed
- Fixed empty link value handling in the model

## [1.0.5] - 2023-11-16

### Fixed
- Fixed null/undefined references
- Added prettier as dev dependency

## [1.0.4] - 2023-11-08

### Fixed
- Fixed same density style multiple generation
- Removed `console.log` debug messages

## [1.0.3] - 2023-11-07

### Fixed
- Default `en` and `hu` language maps embedded in production build
- Removed `console.log` debug messages

### Added
- `Load metadata` checkbox added to the sample template loader

### Changed
- Dev mode config changed to compact initial view (hidden sample template links, hidden core metadata)
- Dependency version updates

## [1.0.2] - 2023-11-03

### Fixed
- Stylesheet not properly rendering
- Multi-instance field add bug

### Changed
- Refactoring: eslint + prettier added

## [1.0.1] - 2023-11-03

### Added
- Changelog
- Code of conduct

### Fixed
- Controlled term field UI update on invalid data
- Model update when date is entered from input (see 'Changed' below)
- Default value selection for dropdowns

### Changed
- Date can only be selected with date picker (no keyboard input)
- Refactored component initialization

### Removed
- Removed extra style inclusion causing duplicate style generation

## [1.0.0] - 2023-09-08

### Added

### Fixed

### Changed

### Removed
