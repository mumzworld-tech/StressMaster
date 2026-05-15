# Changelog

All notable changes to StressMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-01-08

### Added

- **OpenAPI Specification Support**

  - Full support for OpenAPI/Swagger files (`.yaml`, `.yml`, `.json`)
  - Automatic URL resolution from OpenAPI base URLs
  - AI-powered endpoint detection and request generation
  - Automatic JSON body generation from OpenAPI schemas for POST requests
  - Support for referencing OpenAPI files with `@filename.yaml` syntax
  - Example: `stressmaster "send 10 GET requests to /get endpoint from @test-api.yaml"`

- **Enhanced AI Parser**

  - Improved OpenAPI context understanding
  - Better handling of relative URLs in OpenAPI specifications
  - Automatic URL resolution combining base URL + endpoint paths
  - Support for OpenAPI file references in natural language commands
  - Provider-specific endpoint configuration (OpenRouter, OpenAI, Claude, Gemini)
  - Better error messages and validation feedback

- **Improved Error Handling**

  - Graceful handling of disk space errors (ENOSPC)
  - Lightweight test result caching to prevent storage issues
  - Better error messages for OpenAPI parsing failures
  - Enhanced fallback parser with OpenAPI URL resolution
  - Improved error recovery and user feedback

- **Better Logging**
  - Reduced redundant console logs for cleaner output
  - Debug logs only shown with `DEBUG=1` environment variable
  - More informative error messages
  - Cleaner CLI output during test execution

### Fixed

- **Request Count Accuracy**

  - Fixed issue where more requests were sent than specified
  - K6 executor now uses `iterations` for precise request counts in baseline/volume tests
  - Ensures exact number of requested requests are executed
  - Proper handling of virtual users vs request count

- **OpenAPI URL Resolution**

  - Fixed AI parser failing with OpenAPI file references
  - Fixed fallback parser not resolving OpenAPI URLs correctly
  - Fixed URL validation to accept relative paths that will be resolved
  - Fixed file path extraction from commands like "from @test-api.yaml"
  - Fixed URL construction: `/get` now correctly becomes `https://httpbin.org/get`

- **AI Provider Configuration**

  - Fixed OpenRouter provider connecting to wrong endpoint (localhost:11434)
  - Now correctly uses provider-specific default endpoints
  - Improved endpoint configuration for all AI providers
  - Fixed provider initialization and connection issues

- **Body Generation**

  - Fixed OpenAPI YAML files being used as request bodies
  - Now correctly generates JSON bodies from OpenAPI schemas
  - Proper handling of GET vs POST requests with OpenAPI files
  - Fixed body template parsing errors

- **Mobile HTML Export**

  - Fixed mobile layout issue where subtitle elements wrapped incorrectly
  - Improved responsive design for test result exports
  - Better horizontal scrolling for long content
  - Fixed "view" button wrapping to next line on mobile

- **Test Result Caching**
  - Fixed ENOSPC (no space left on device) errors
  - Implemented lightweight caching with truncated logs
  - Proactive size checks before saving large result files

### Changed

- **Unified Directory Structure**

  - All generated files now use `.stressmaster/` directory
  - Automatic `.gitignore` management
  - Better organization of cache, config, and results

- **Parser Improvements**

  - Enhanced fallback parser with better OpenAPI detection
  - Improved endpoint path extraction from natural language
  - Better handling of file references in commands
  - More robust URL validation and resolution

- **Code Quality**
  - Improved TypeScript type safety
  - Better error handling throughout the codebase
  - Enhanced validation for AI parser responses
  - More robust file path resolution

## [1.0.2] - 2024-12-02

### Added

- Unified `.stressmaster/` directory for all generated files
- Automatic `.gitignore` management
- Interactive setup wizard (`stressmaster setup`)
- Improved module resolution for npm packages
- Support for localhost API testing
- Batch request support with modular architecture
- Media file upload support in requests
- Retry functionality for failed requests

### Fixed

- Module resolution issues when installed as npm package
- File path resolution in linked packages
- K6 executor script generation and results parsing
- Batch execution and virtual user defaults
- Media upload stream errors in batch tests
- Duration calculation issues
- URL resolution issues

### Changed

- Consolidated all documentation into single README.md
- Improved error handling and logging
- Enhanced file autocomplete in interactive CLI
- Refactored AI provider architecture
- Removed Ollama provider dependency
- Cleaned up CLI output and removed unnecessary logs

## [1.0.0] - 2024-11-XX

### Added

- Initial release of StressMaster
- Natural language command parsing
- Multiple AI provider support (Claude, OpenAI, Gemini, OpenRouter)
- K6 integration for load test execution
- Multiple test types (spike, stress, endurance, volume, baseline)
- Real-time monitoring and progress tracking
- Comprehensive reporting with AI-powered recommendations
- Export formats (JSON, CSV, HTML)
- Interactive CLI interface
- Docker-based deployment
- Local-first architecture

## [Unreleased]

### Planned

- Additional test types and load patterns
- Enhanced reporting features
- More OpenAPI specification features
- Performance optimizations
- Extended AI model support
- Web UI improvements
- Advanced analytics and insights

---

## Version History

- **1.0.3** - OpenAPI support, AI parser improvements, bug fixes
- **1.0.2** - Module resolution, batch support, media uploads
- **1.0.0** - Initial stable release
