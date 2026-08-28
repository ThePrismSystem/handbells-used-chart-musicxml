-- Handbells used chart: Dorico layout setup
--
-- Run this once, after importing the chart MusicXML into your project as a
-- new flow (File > Import > MusicXML, with "Create All New Players").
--
-- Everything here is a Layout Option. Dorico's MusicXML import deliberately
-- discards layout and re-engraves, so none of it can be carried in the chart
-- file itself -- that is the whole reason this script exists.
--
-- LayoutIDArray=0 is the first layout, normally the full score. If you want
-- the chart in other layouts too, run the commands again with their IDs.

local app = DoApp.DoApp()

-- Staff labels off, on the first system and every later one. The chart names
-- itself with text above its staves, so a margin label is a second one saying
-- the same thing.
app:doCommand([[Project.Layout.SetOptions?LayoutIDArray=0&Dictionary=list: {string: "staffLabelLayoutOptions.staffLabelsOnFirstSystem"}\, {int: 2}\, {string: "staffLabelLayoutOptions.staffLabelsOnSubsequentSystems"}\, {int: 2}]])

-- Hide empty staves, including half of a grand staff. Players are assigned per
-- flow, so the chart staves should already be absent from the music -- this
-- covers the case where they are not.
app:doCommand([[Project.Layout.SetOptions?LayoutIDArray=0&Dictionary=list: {string: "allowPartialHidingOfGrandStaveInstruments"}\, {bool: true}\, {string: "hideEmptyStavesPolicy"}\, {int: 0}]])

-- TWO SETTINGS THIS SCRIPT CANNOT YET MAKE
--
-- Both are in Layout Options > Page Setup > Flows, and both matter:
--
--   1. "Allow on existing page" -- without it the music starts on its own
--      page instead of continuing under the chart.
--   2. "Show Flow Headings" -> Never -- going from one flow to two can print
--      a heading above your music that was never there before.
--
-- Their command strings are not documented. To capture them: Script > Start
-- Recording Script, change just those two settings in Layout Options, then
-- Script > Stop Recording. Paste the recorded doCommand lines below and they
-- will run with the rest.
--
-- Guessing the option keys would produce a script that looks like it worked
-- and silently did nothing, which is worse than saying so here.
