package com.dipaknehe.stockvalue

/**
 * Files the web app hands to the app to save or share (its "Download CSV" buttons), see MainActivity.FileBridge.
 * Plain Kotlin with no Android types, so it's unit-tested on the JVM (FileExportTest).
 */
object FileExport {
    /** Largest file accepted from the page (the CSVs are a few kilobytes). */
    const val MAX_CHARS = 2_000_000

    /**
     * A safe name for the shared file: only letters, digits, dot, dash and underscore (no folders, so it can't
     * escape the app's export folder), at most 80 characters, ending in ".csv".
     */
    fun safeName(name: String): String {
        val base = name.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .trimStart('.')
            .take(80)
        val n = base.ifBlank { "export" }
        return if (n.endsWith(".csv", ignoreCase = true)) n else "$n.csv"
    }
}
