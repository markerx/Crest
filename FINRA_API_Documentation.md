# FINRA API Developer Center Documentation

## Overview

The FINRA API Developer Center is a strategic initiative to support automation goals of member firms and the broader financial services industry. The platform provides machine-to-machine interfaces for accessing FINRA data and submitting filings.

**Base URL**: https://developer.finra.org

## Available API Products

FINRA offers three main API products:

### 1. Query API (Data Out API)

The Query API allows third-party systems to access a variety of data categories via a standard query interface.

**Key Features**:
- Over 50 datasets accessible using the same API request structure
- Supports both synchronous and asynchronous requests
- Provides access to OTC Transparency data, equity data, registration data, and more

**Available Datasets**:
- Market Transparency Datasets (no authentication required)
- Weekly Summary (production: rolling 12 months, historic: rolling 4 years)
- OTC Trade and Equity data
- Registration datasets
- Individual Fingerprint dataset (added 2025)

**Example Endpoints**:
- `/api-explorer/query_api-equity-weekly_summary`
- ATS and OTC (Non-ATS) data aggregated by issue, firm, or statistics

### 2. Submission API

The Submission API allows third-party systems to submit filings and other data to FINRA via a standard submission interface.

**Key Features**:
- Standard interface for filing submissions
- OAuth 2.0 authentication required
- Subject to rate limiting

### 3. Notification API

The Notification API allows third-party systems to detect changes related to FINRA datasets/resources via polling.

**Key Features**:
- Change detection mechanism
- Polling-based architecture
- OAuth 2.0 authentication required

## Authentication

### OAuth 2.0 Flow

FINRA API Platform uses OAuth 2.0 for authentication and authorization, which enhances security by using limited life span tokens instead of long-lasting credentials.

**Token Endpoint**: `https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token`

**Authentication Steps**:

1. **Request Access Token**:
   - Send POST request to FIP (FINRA Identity Platform)
   - Use API Client ID and API Client Secret as Basic Auth token in Authorization Header
   - Receive `access_token` and `expires_in` in response

2. **Use Access Token**:
   - Include `access_token` as Bearer token in Authorization Header
   - Token expires after time specified in `expires_in` (seconds)
   - Cache token for up to 30 minutes before regenerating

3. **API Credentials**:
   - Create API credentials via API Console
   - Fingerprint API Credential capability added in 2025 for member firms
   - Production access requires Multi-Factor Authentication (MFA)

**Example Authorization Header**:
```
Authorization: Bearer {access_token}
```

## Rate Limits and Restrictions

### Throttling Limits

**Synchronous Requests**:
- 1200 requests per minute per IP address

**Asynchronous Requests**:
- 20 requests per minute per dataset per API account

### Record and Payload Limits

Enforced since April 6, 2020:

**Synchronous Requests**:
- Maximum 5,000 records OR 3MB payload (whichever is reached first)
- Returns data in response body

**Asynchronous Requests**:
- Maximum 100,000 records
- No payload size limit
- Use for large datasets

## API Explorer

FINRA provides an interactive API Explorer at developer.finra.org that allows you to:
- Try out API calls directly in the browser
- View interactive API documentation
- Test against mock/test data (not production data)

## Recent Updates (2025)

### March 3rd, 2025 Release
- Added Fingerprint API Credential capability
- Individual Fingerprint Dataset now available
- Provides fingerprint status code and final status flag for individuals associated with firms

### Authentication Migration
- Platform migrated to OAuth 2.0 authentication for enhanced security
- MFA requirement for production access to reference data

## OTC Transparency Data API

Special focus area for accessing Over-the-Counter transparency data.

**Data Types**:
- ATS (Alternative Trading System) data
- Non-ATS OTC data
- Aggregation options: by issue, by firm, statistics
- Weekly and monthly data available

**Data Retention**:
- Production datasets: rolling 12 months
- Historic datasets: rolling 4 years (starting 1 year prior to current date)

## Resources

- **Documentation**: https://developer.finra.org/docs
- **API Products**: https://developer.finra.org/products
- **Getting Started**: https://developer.finra.org/node/1146
- **FAQ**: https://developer.finra.org/support
- **Postman Guide**: https://developer.finra.org/UsingPostmantocalltheFINRAAPIPlatform
- **Release Notes**: https://developer.finra.org/release-notes/
- **API Credentials**: https://developer.finra.org/APICredentials

## Market Transparency Datasets

Note: Market Transparency Datasets do not require production API credentials. You can utilize these datasets without providing an Authorization token on API requests.

## Best Practices

1. **Token Management**:
   - Cache access tokens for up to 30 minutes
   - Regenerate tokens before expiration
   - Securely store Client ID and Client Secret

2. **Rate Limit Management**:
   - Monitor request rates to stay within limits
   - Use asynchronous requests for large datasets
   - Implement retry logic with exponential backoff

3. **Data Retrieval**:
   - Use synchronous requests for small queries (<5,000 records)
   - Use asynchronous requests for large datasets (>5,000 records)
   - Respect 3MB payload limit for synchronous requests

4. **Testing**:
   - Use API Explorer for initial testing with mock data
   - Test against non-production environments before going live
   - Follow Postman guide for practical implementation examples

## Support

For questions and support, visit: https://developer.finra.org/support
