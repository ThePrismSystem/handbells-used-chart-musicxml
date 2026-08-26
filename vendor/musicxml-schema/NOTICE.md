# MusicXML 4.0 schema

These files are the W3C XML Schema definitions for MusicXML 4.0, taken from
<https://github.com/w3c-cg/musicxml/releases/tag/v4.0>.

Copyright © 2004-2021 the Contributors to the MusicXML Specification, published
by the W3C Music Notation Community Group under the W3C Community Final
Specification Agreement (FSA):
<https://www.w3.org/community/about/agreements/final/>

They are included here solely so the test suite can validate generated
documents offline. They are not part of this project's own source and are not
covered by its licence.

**Modification:** the two `xs:import` `schemaLocation` attributes in
`musicxml.xsd` were changed from absolute `http://www.musicxml.org/xsd/…` URLs
to the bare filenames `xml.xsd` and `xlink.xsd`, so validation resolves them
locally. The `namespace` attributes on those same two lines are unchanged —
they are XML namespace URIs, not fetchable locations. Nothing else was altered.
