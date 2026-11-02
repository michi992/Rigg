# Dewald Rig Studio

Ein lokaler 3D-Rigging-Editor für aktuelle Windows-Browser. Das Programm verarbeitet Modelle im Browser; Modelle werden nicht an einen Server hochgeladen.

Online-App: https://dewald-rig-studio.michaeld2907.chatgpt.site

## Start

Die eigenständige Datei dist/dewald-rig-studio.html herunterladen und per Doppelklick öffnen. Keine Installation und keine Internetverbindung erforderlich. Die veröffentlichte App bietet dieselbe Datei über „Offline-Version herunterladen“ an.

## Bedienung

1. Das Beispielmodell verwenden oder GLB/OBJ importieren.
2. Unter „Skelett“ Knochen auswählen, Positionen anpassen und Kindknochen ergänzen. Auf WebGL-Geräten stehen zusätzlich 3D-Achsenwerkzeuge bereit.
3. Unter „Pose“ lokale Rotationen verändern. „Gewichte“ zeigt den Einfluss des ausgewählten Knochens.
4. Auf der Zeitleiste Frames 0–120 wählen, Posen einstellen und Keyframes setzen. Die Animation verwendet 24 FPS.
5. Mit „Speichern“ eine .rig.json-Sicherungsdatei herunterladen. „GLB exportieren“ exportiert Mesh, Skelett, Gewichte und gesetzte Animations-Keyframes. Ohne Keyframes enthält GLB die Ruhepose.

Strg+S: Projektdatei speichern. Strg+Z/Y: rückgängig/wiederholen. F: Ansicht zentrieren. Leertaste: Wiedergabe. Die Anleitung ist über das Fragezeichen erreichbar.

## Grenzen

- Distanzbasierte automatische Gewichtung mit bis zu vier Knochen pro Vertex. Kein manuelles Weight Painting, Heat-Weighting, IK oder Facial Rigging.
- Modellimport: maximal 35 MB und 300.000 Vertices; bearbeitbare Projekte: bis zu 100 Knochen.
- Importiert werden eigenständige, unkomprimierte GLB-Dateien oder OBJ-Geometrie. Externe Ressourcen, Draco, Meshopt, KTX2, FBX und OBJ-MTL-Dateien werden nicht geladen.
- Importmodelle werden auf 3 m Höhe normalisiert. Das Humanoid-Skelett wird im Editor an das eigene Modell angepasst; automatische anatomische Erkennung ist nicht enthalten.
- Bestehende GLB-Rigs und Animationen werden beim Modellimport durch das neue Rig ersetzt. Morph-Ziele werden nicht übernommen.
- Ohne WebGL 2 verwendet die App eine Canvas-Softwareansicht mit vereinfachten Materialien und ohne Texturabbildung oder 3D-Transformationsgriffe. Positionen und Rotationen bleiben über die Wertefelder bearbeitbar.
- Die automatische Sicherung gilt für den aktuellen Browser. Für eine eigene Sicherungsdatei „Speichern“ verwenden.

## Entwicklung

Node.js installieren, dann:

    npm ci
    npm run check
    node --test tests/rig-core.test.mjs
    npm run build

Der Build erstellt die Webversion und eine einzelne HTML-Datei mit eingebettetem JavaScript und CSS.

## Tests

Geprüft: normalisierte Skin-Gewichte und Ruhepose, Vertex-Verformung und Rücksetzen, Quaternion-Interpolation, GLB-Export/Import einschließlich Animation und Knochenhierarchie sowie sichere Ablehnung zyklischer Skelette.

Three.js 0.180.0 ist unter der MIT-Lizenz eingebunden. Der Lizenztext liegt in dist/THREE-LICENSE.txt und ist auch in der Offline-HTML-Datei enthalten.
