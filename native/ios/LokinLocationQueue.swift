import Foundation
import SQLite3

final class LokinLocationQueue {
    private let dbQueue = DispatchQueue(label: "ai.lokin.location.sqlite")
    private var db: OpaquePointer?

    init(filename: String = "lokin-location.sqlite3") throws {
        let fm = FileManager.default
        let base = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let url = base.appendingPathComponent(filename)
        guard sqlite3_open(url.path, &db) == SQLITE_OK else {
            throw NSError(domain: "LokinLocationQueue", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not open location queue"])
        }
        let sql = """
        CREATE TABLE IF NOT EXISTS location_queue (
          seq INTEGER PRIMARY KEY,
          created_at_ms INTEGER NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_location_queue_created ON location_queue(created_at_ms);
        """
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else {
            throw NSError(domain: "LokinLocationQueue", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not initialize location queue"])
        }
    }

    deinit { sqlite3_close(db) }

    func enqueue(_ sample: LokinLocationSample) {
        dbQueue.async { [weak self] in
            guard let self, let db = self.db,
                  let data = try? JSONEncoder().encode(sample),
                  let json = String(data: data, encoding: .utf8) else { return }
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, "INSERT OR REPLACE INTO location_queue(seq, created_at_ms, payload) VALUES(?,?,?)", -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_int64(stmt, 1, sample.seq)
            sqlite3_bind_int64(stmt, 2, sample.timestampMs)
            sqlite3_bind_text(stmt, 3, json, -1, SQLITE_TRANSIENT)
            sqlite3_step(stmt)
        }
    }

    func read(limit: Int = 120, completion: @escaping ([LokinLocationSample]) -> Void) {
        dbQueue.async { [weak self] in
            guard let self, let db = self.db else { return completion([]) }
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, "SELECT payload FROM location_queue ORDER BY seq ASC LIMIT ?", -1, &stmt, nil) == SQLITE_OK else { return completion([]) }
            sqlite3_bind_int(stmt, 1, Int32(max(1, min(limit, 500))))
            var result: [LokinLocationSample] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let cString = sqlite3_column_text(stmt, 0) else { continue }
                let json = String(cString: cString)
                if let data = json.data(using: .utf8), let sample = try? JSONDecoder().decode(LokinLocationSample.self, from: data) {
                    result.append(sample)
                }
            }
            completion(result)
        }
    }

    func acknowledge(throughSeq seq: Int64) {
        dbQueue.async { [weak self] in
            guard let self, let db = self.db else { return }
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, "DELETE FROM location_queue WHERE seq <= ?", -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_int64(stmt, 1, seq)
            sqlite3_step(stmt)
        }
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
