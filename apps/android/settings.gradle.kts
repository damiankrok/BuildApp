/**
 * BuildPlan Model Preview — the native Android viewer for BuildApp's compiled
 * scenes.
 *
 * It is a self-contained Gradle build inside the npm monorepo: the npm side
 * owns the model, the compiler and the scene export; this side only renders
 * what the exporter wrote into `app/src/main/assets/scenes`.
 */
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "buildapp-android-preview"
include(":app")
