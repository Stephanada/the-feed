/**
 * THE FEED — Canonical Event Schema
 * Data Standard: schema.org/Event as JSON-LD
 * Validation: Zod
 * ID Generation: Deterministic SHA-256 → evt_[hash]
 *
 * Hash input: lowercase(performer + startDate + location.name)
 */

import { z } from "zod";
import { createHash } from "crypto";

// ─────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────

export const GeoSchema = z.object({
  "@type": z.literal("GeoCoordinates"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const LocationSchema = z.object({
  "@type": z.literal("Place"),
  name: z.string().min(1, "Venue name is required"),
  address: z.object({
    "@type": z.literal("PostalAddress"),
    streetAddress: z.string().optional(),
    addressLocality: z.string().min(1, "City is required"),
    addressRegion: z.string().optional(),
    postalCode: z.string().optional(),
    addressCountry: z.string().length(2, "ISO 3166-1 alpha-2 country code required"),
  }),
  geo: GeoSchema.optional(),
  url: z.string().url().optional(),
});

export const PerformerSchema = z.object({
  "@type": z.enum(["Person", "MusicGroup", "PerformingGroup"]),
  name: z.string().min(1, "Performer name is required"),
  url: z.string().url().optional(),
  sameAs: z.array(z.string().url()).optional(), // Spotify, Bandcamp, etc.
});

export const OrganizerSchema = z.object({
  "@type": z.enum(["Organization", "Person"]),
  name: z.string().min(1),
  url: z.string().url().optional(),
  email: z.string().email().optional(),
});

export const OfferSchema = z.object({
  "@type": z.literal("Offer"),
  price: z.number().min(0).optional(),
  priceCurrency: z.string().length(3, "ISO 4217 currency code required").default("CAD"),
  availability: z
    .enum([
      "https://schema.org/InStock",
      "https://schema.org/SoldOut",
      "https://schema.org/PreOrder",
    ])
    .optional(),
  url: z.string().url().optional(),
  validFrom: z.string().datetime({ offset: true }).optional(),
  description: z.string().optional(),
});

// ─────────────────────────────────────────────
// Feed-specific extensions (not in schema.org)
// ─────────────────────────────────────────────

export const FeedMetaSchema = z.object({
  /** Geographic distribution scope */
  scope: z.enum(["local", "regional", "national"]).default("local"),
  /** Target network sites (hub-and-spoke routing) */
  targetGroups: z.array(z.string()).default([]),
  /** Source authority level for conflict resolution */
  sourceAuthority: z
    .enum(["corporate_admin", "verified_venue", "automated_scraper", "public_submission"])
    .default("public_submission"),
  /** Branch this record currently lives on */
  branch: z.enum(["staging", "production"]).default("staging"),
  /** UTC timestamp of record creation */
  createdAt: z.string().datetime({ offset: true }),
  /** UTC timestamp of last modification */
  updatedAt: z.string().datetime({ offset: true }),
  /** URL / name of the original data source */
  sourceUrl: z.string().url().optional(),
  /** Brand-safety flag set by NLP moderation pass */
  brandSafe: z.boolean().default(true),
  /** Moderation rejection reason, if any */
  rejectionReason: z.string().optional(),
});

// ─────────────────────────────────────────────
// Root Event Schema
// ─────────────────────────────────────────────

export const EventSchema = z
  .object({
    "@context": z.literal("https://schema.org"),
    "@type": z.literal("Event"),

    /** Deterministic ID: evt_[SHA-256(lowercase(performer+date+venue))] */
    "@id": z
      .string()
      .regex(/^evt_[a-f0-9]{64}$/, "ID must be in format evt_[sha256hex]"),

    name: z.string().min(1, "Event name is required"),
    description: z.string().optional(),
    image: z.string().url().optional(),

    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }).optional(),
    doorTime: z.string().datetime({ offset: true }).optional(),

    location: LocationSchema,
    performer: z.union([PerformerSchema, z.array(PerformerSchema)]).optional(),
    organizer: z.union([OrganizerSchema, z.array(OrganizerSchema)]).optional(),
    offers: z.union([OfferSchema, z.array(OfferSchema)]).optional(),

    eventStatus: z
      .enum([
        "https://schema.org/EventScheduled",
        "https://schema.org/EventCancelled",
        "https://schema.org/EventPostponed",
        "https://schema.org/EventRescheduled",
        "https://schema.org/EventMovedOnline",
      ])
      .default("https://schema.org/EventScheduled"),

    eventAttendanceMode: z
      .enum([
        "https://schema.org/OfflineEventAttendanceMode",
        "https://schema.org/OnlineEventAttendanceMode",
        "https://schema.org/MixedEventAttendanceMode",
      ])
      .default("https://schema.org/OfflineEventAttendanceMode"),

    url: z.string().url().optional(),

    /** Music-specific: genre tags */
    genre: z.array(z.string()).optional(),
    /** Music-specific: age restriction */
    typicalAgeRange: z.string().optional(),

    /** The Feed proprietary metadata */
    _feed: FeedMetaSchema,
  })
  .strict();

// ─────────────────────────────────────────────
// Deterministic ID Generation
// ─────────────────────────────────────────────

/**
 * Generates a deterministic SHA-256 event ID.
 * Input: lowercase(primaryPerformerName + ISO8601Date + venueName)
 *
 * @param {string} performer  - Primary performer / artist name
 * @param {string} startDate  - ISO 8601 date string (only date portion used)
 * @param {string} venueName  - Venue name
 * @returns {string} evt_[64-char sha256 hex]
 */
export function generateEventId(performer, startDate, venueName) {
  // Normalize: lowercase, trim whitespace, collapse internal spaces
  const normalize = (s) =>
    String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  // Use date portion only (YYYY-MM-DD) for stability across timezone offsets
  const datePart = normalize(startDate).substring(0, 10);

  const hashInput = `${normalize(performer)}|${datePart}|${normalize(venueName)}`;
  const hash = createHash("sha256").update(hashInput, "utf8").digest("hex");

  return `evt_${hash}`;
}

/**
 * Derives event ID from a fully-formed event payload.
 * Resolves performer from array or single object.
 *
 * @param {object} eventPayload - Partial or full event object
 * @returns {string} evt_[sha256]
 */
export function deriveEventId(eventPayload) {
  const performer = Array.isArray(eventPayload.performer)
    ? eventPayload.performer[0]?.name ?? ""
    : eventPayload.performer?.name ?? "";

  return generateEventId(
    performer,
    eventPayload.startDate ?? "",
    eventPayload.location?.name ?? ""
  );
}

// ─────────────────────────────────────────────
// Validate & Stamp — primary write entry point
// ─────────────────────────────────────────────

/**
 * Validates an event payload, generates its deterministic ID, and returns
 * the fully-stamped, production-ready JSON-LD object.
 *
 * Throws a ZodError on validation failure.
 *
 * @param {object} rawPayload     - Incoming event data (may lack @id and _feed.createdAt)
 * @param {object} [metaOverrides] - Override specific _feed fields (e.g. sourceAuthority)
 * @returns {{ event: object, isNew: boolean }}
 */
export function validateAndStamp(rawPayload, metaOverrides = {}) {
  const now = new Date().toISOString();
  const id = deriveEventId(rawPayload);

  const stamped = {
    "@context": "https://schema.org",
    "@type": "Event",
    ...rawPayload,
    "@id": id,
    _feed: {
      scope: "local",
      targetGroups: [],
      sourceAuthority: "public_submission",
      branch: "staging",
      brandSafe: true,
      ...rawPayload._feed,
      ...metaOverrides,
      createdAt: rawPayload._feed?.createdAt ?? now,
      updatedAt: now,
    },
  };

  // Will throw ZodError with detailed field-level messages on failure
  const parsed = EventSchema.parse(stamped);
  return { event: parsed, id };
}
