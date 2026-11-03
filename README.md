# Dewald Rig Studio

3D-Rigging im Browser: ein Modell laden, Knochen anpassen und eine kurze Animation erstellen. Die Modelldaten bleiben auf dem eigenen Gerät.

## Starten

Repository über **Code → Download ZIP** herunterladen und entpacken. Anschließend die Datei **dist/dewald-rig-studio.html** öffnen. Für diese Version sind weder Node.js noch eine Internetverbindung nötig.

Zum Ausprobieren ist ein Beispielmodell vorhanden. Eigene Modelle lassen sich als unkomprimierte GLB- oder OBJ-Datei laden. Für das Humanoid-Skelett eignet sich eine T-Pose mit Blickrichtung +Z.

## Arbeiten mit dem Editor

1. Unter **Skelett** Gelenke auswählen und ihre Position an das Modell anpassen. Mit **+** wird ein Kindknochen angelegt.
2. Unter **Pose** die lokalen Rotationen ändern. **Gewichte** zeigt den Einfluss des ausgewählten Knochens.
3. Einen Frame wählen und **Keyframe setzen** drücken. Für eine Bewegung mindestens zwei verschiedene Frames belegen; die Vorschau läuft mit 24 FPS.
4. **Speichern** erstellt eine bearbeitbare .rig.json-Datei. **GLB exportieren** gibt Modell, Rig und gesetzte Animation aus. Ohne Keyframes wird die Ruhepose exportiert.

Strg+S speichert das Projekt, Strg+Z/Y geht zurück/vor, F zentriert die Ansicht, die Leertaste startet oder stoppt die Vorschau. Die Browsersicherung ersetzt keine eigene Projektdatei.

## Einschränkungen

Die Gewichtung beruht auf Knochenabständen und kann an schwierigen Gelenken Nacharbeit benötigen. Weight Painting und IK sind noch nicht enthalten. Der Import normalisiert Modelle auf 3 m Höhe und ersetzt vorhandene Rigs und Animationen; Morph-Ziele werden nicht übernommen.

Modelle sind auf 35 MB und 300.000 Vertices begrenzt, Projekte auf 100 Knochen. Externe OBJ-Materialdateien sowie Draco-, Meshopt- und KTX2-Kompression werden nicht geladen. Ohne WebGL 2 gibt es eine vereinfachte Softwareansicht; Knochen werden dort über die Wertefelder bearbeitet.

## Entwicklung

Node.js ab Version 18:

    npm ci
    npm run check
    npm test
    npm run build

Der Build legt die Webversion und die einzelne Offline-HTML-Datei unter dist ab. Mit npm run format wird der Quellcode formatiert.

Die UI liegt in src/app.js, Skinning und Animation in src/rig-core.js. Projektdateien werden in src/project-files.js verarbeitet, die Icons in src/icons.js. src/software-renderer.js enthält die Canvas-Ansicht. Die Tests prüfen Gewichtung, Verformung, Projektimport und den GLB-Export mit anschließendem Rückimport.

Three.js wird unter der MIT-Lizenz verwendet. Der Lizenztext liegt in dist/THREE-LICENSE.txt und ist auch in der Offline-Datei enthalten.
