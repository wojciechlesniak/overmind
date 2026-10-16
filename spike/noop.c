#include <sqlite3ext.h>
SQLITE_EXTENSION_INIT1
int sqlite3_noop_init(sqlite3 *db, char **error, const sqlite3_api_routines *api) {
  (void)db;
  (void)error;
  SQLITE_EXTENSION_INIT2(api);
  return SQLITE_OK;
}
