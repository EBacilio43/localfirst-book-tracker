CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`isbn13` text,
	`isbn10` text,
	`title` text NOT NULL,
	`subtitle` text,
	`series_name` text,
	`series_index` real,
	`authors_json` text DEFAULT '[]' NOT NULL,
	`translator` text,
	`publisher` text,
	`description` text,
	`cover_uri` text,
	`page_count` integer DEFAULT 0 NOT NULL,
	`modality` text DEFAULT 'PHYSICAL' NOT NULL,
	`ownership` text DEFAULT 'OWNED' NOT NULL,
	`metadata_status` text DEFAULT 'COMPLETE' NOT NULL,
	`format` text,
	`progress_mode` text DEFAULT 'PAGES' NOT NULL,
	`language` text DEFAULT 'es' NOT NULL,
	`current_status` text DEFAULT 'POR_LEER' NOT NULL,
	`current_page` integer DEFAULT 0 NOT NULL,
	`current_percentage` real DEFAULT 0 NOT NULL,
	`rating` real,
	`pause_or_dnf_note` text,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`shelf_id` text,
	`wishlist_store_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shelves` (
	`id` text PRIMARY KEY NOT NULL,
	`furniture_name` text NOT NULL,
	`shelf_level` text,
	`color_tag` text DEFAULT '#1E4635' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`start_page` integer DEFAULT 0 NOT NULL,
	`end_page` integer DEFAULT 0 NOT NULL,
	`pages_read` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`started_at_epoch_ms` integer NOT NULL,
	`local_date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reading_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`read_number` integer DEFAULT 1 NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`rating` real,
	`review` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`entry_type` text DEFAULT 'QUOTE' NOT NULL,
	`content` text NOT NULL,
	`page_number` integer,
	`chapter_or_section` text,
	`personal_note` text,
	`highlight_color` text DEFAULT '#F3E8CB' NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_loans` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`loan_direction` text DEFAULT 'LENT_OUT' NOT NULL,
	`borrower_name` text NOT NULL,
	`borrower_contact` text,
	`loaned_at` integer NOT NULL,
	`due_date` integer,
	`returned_at` integer,
	`notification_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reading_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`period_type` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`target_books` integer DEFAULT 0 NOT NULL,
	`target_pages` integer DEFAULT 0 NOT NULL,
	`target_minutes_per_day` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
