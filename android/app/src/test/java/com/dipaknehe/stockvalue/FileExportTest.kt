package com.dipaknehe.stockvalue

import org.junit.Assert.assertEquals
import org.junit.Test

class FileExportTest {
    @Test
    fun theWebAppsFileNamesAreKept() {
        assertEquals("my-portfolio.csv", FileExport.safeName("my-portfolio.csv"))
        assertEquals("KO-10-year-figures.csv", FileExport.safeName("KO-10-year-figures.csv"))
        assertEquals("BRK.B-10-year-figures.csv", FileExport.safeName("BRK.B-10-year-figures.csv"))
    }

    @Test
    fun namesCantLeaveTheExportFolderOrHideAsDotFiles() {
        assertEquals("passwd.csv", FileExport.safeName("../../etc/passwd"))
        assertEquals("evil.csv", FileExport.safeName("..\\evil.csv"))
        assertEquals("profile.csv", FileExport.safeName(".profile"))
    }

    @Test
    fun oddCharactersAreReplacedAndTheNameIsShortAndEndsInCsv() {
        assertEquals("a_b_c.csv", FileExport.safeName("a b<c"))
        assertEquals("export.csv", FileExport.safeName(""))
        assertEquals("export.csv", FileExport.safeName("..."))
        assertEquals(84, FileExport.safeName("x".repeat(200)).length)   // 80 characters plus ".csv"
    }
}
