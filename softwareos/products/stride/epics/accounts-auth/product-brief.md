# Accounts & Auth — Product Brief

> Epic: epic.md · Product: ../../mission.md

## Goals

Checkout, order history and wishlist all need to know who the shopper is.

- Quick email + password sign-up and login with clear inline errors.
- A secure session.
- Protected routes that redirect to /login and return the user where they were.

## User Stories

- As a new shopper, I can sign up with email and password so I can check out and save favorites.
- As a returning shopper, I can log in and stay logged in across pages.
- As a shopper, I see inline errors for a wrong password or an email that's already registered.
- As a logged-out shopper, opening /checkout, /account or /wishlist sends me to login, then back to that page.
- As a logged-in shopper, I can log out from the header.

## Success Criteria

- Sign-up creates a user with a bcrypt-hashed password. Plain passwords are never stored or logged.
- Login sets an httpOnly session cookie, and the header shows logged-in state.
- The wrong-password and existing-email errors show inline and match Figma.
- Middleware protects /checkout, /account, /wishlist, with a working return-to redirect.
- Zod validates the forms on client and server.
- Playwright: sign up → log out → log in → reach a protected page passes in CI.

## Out of Scope

- Password reset
- Social login
- Email verification
- Email notifications
- The profile page itself (account-wishlist epic)
