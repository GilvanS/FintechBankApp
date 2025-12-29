# 🔧 Resolver Erro de Classes Duplicadas do Kotlin

## ⚠️ Erro

```
Duplicate class kotlin.collections.jdk8.CollectionsJDK8Kt found in modules 
kotlin-stdlib-1.8.22.jar and kotlin-stdlib-jdk8-1.6.21.jar
```

**Causa:** Conflito de versões do Kotlin entre dependências.

---

## ✅ Solução Aplicada

Adicionada resolução de dependências em **dois lugares** para forçar a mesma versão do Kotlin:

### 1. No `build.gradle` raiz (aplica a todos os módulos):

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
    }
    
    // Resolver conflito de versões do Kotlin em todos os módulos
    configurations.all {
        resolutionStrategy {
            force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
        }
    }
}
```

### 2. No `app/build.gradle` (garantia extra):

```gradle
dependencies {
    // ... outras dependências ...
    
    // Resolver conflito de versões do Kotlin
    configurations.all {
        resolutionStrategy {
            force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
        }
    }
}
```

---

## 🚀 Próximos Passos

### 1. Limpar Build Anterior

No Android Studio:
- **Build → Clean Project**

Ou via terminal:
```powershell
cd MOBILE/android
./gradlew clean
```

### 2. Sincronizar Gradle

No Android Studio:
- **File → Sync Project with Gradle Files**

### 3. Gerar APK

No Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## ✅ Verificação

Após aplicar a correção, o build deve completar sem erros de classes duplicadas.

---

**Última atualização:** 2025-01-27

