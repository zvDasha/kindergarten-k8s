# CHECKLIST.md

## Jak uruchomić projekt lokalnie (minikube)

Do uruchomienia potrzebny jest Docker, minikube i kubectl.

Startujemy klaster i włączamy ingress:

```bash
minikube start
minikube addons enable ingress
```

Czekamy aż kontroler Ingress będzie gotowy:

```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

Budujemy obrazy wewnątrz minikube. Krok z eval jest ważny, bo bez niego obrazy trafią do lokalnego Dockera zamiast do minikube:

```bash
eval $(minikube docker-env)
docker build -t kindergarten-backend:local ./backend
docker build -t kindergarten-frontend:k8s ./frontend
```

Zmieniamy nazwę obrazu w manifeście frontend na lokalną:

```bash
# W k8s/frontend.yaml ustaw:
# image: kindergarten-frontend:k8s
# imagePullPolicy: Never
```

Aplikujemy namespace jako pierwszy, potem resztę:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

Ustawiamy namespace jako domyślny:

```bash
kubectl config set-context --current --namespace=kindergarten
```

Uruchamiamy tunnel (w osobnym terminalu, trzymamy otwarty):

```bash
minikube tunnel
```

Otwieramy aplikację w przeglądarce: http://127.0.0.1/

---

## Lista zasobów Kubernetes

Poniżej pełna lista zasobów wdrożonych w klastrze:

- Namespace: kindergarten (k8s/namespace.yaml)
- Deployment: backend, 2 repliki (k8s/backend.yaml)
- Deployment: frontend (k8s/frontend.yaml)
- Deployment: mqtt, broker Mosquitto (k8s/mgtt.yaml)
- StatefulSet: mongodb (k8s/mongo.yaml)
- Service: backend, ClusterIP, port 3000 (k8s/backend.yaml)
- Service: frontend, ClusterIP, port 80 (k8s/frontend.yaml)
- Service: mongodb, headless ClusterIP, port 27017 (k8s/mongo.yaml)
- Service: mqtt, ClusterIP, port 1883 (k8s/mgtt.yaml)
- Ingress: app-ingress, nginx (k8s/ingress.yaml)
- ConfigMap: app-config (k8s/configmap.yaml)
- Secret: app-secret (k8s/secret.yaml)
- PersistentVolumeClaim: mongo-storage-mongodb-0, 1Gi (k8s/mongo.yaml, volumeClaimTemplates)
- NetworkPolicy: mongo-only-from-backend (k8s/networkpolicy.yaml)
- NetworkPolicy: mqtt-only-from-backend (k8s/networkpolicy.yaml)
- PodDisruptionBudget: backend-pdb, minAvailable: 1 (k8s/pdb.yaml)

---

## Komendy kubectl do weryfikacji

Sprawdzenie wszystkich zasobów naraz:

```bash
kubectl get all -n kindergarten
```

Sprawdzenie podów:

```bash
kubectl get pods -n kindergarten
```

Sprawdzenie deploymentów i replik:

```bash
kubectl get deploy -n kindergarten
```

Sprawdzenie rolling update:

```bash
kubectl rollout status deployment/backend -n kindergarten
```

Sprawdzenie PVC:

```bash
kubectl get pvc -n kindergarten
```

Sprawdzenie Ingress:

```bash
kubectl get ingress -n kindergarten
```

Sprawdzenie ConfigMap i Secret:

```bash
kubectl get configmap -n kindergarten
kubectl get secret -n kindergarten
```

Sprawdzenie NetworkPolicy:

```bash
kubectl get networkpolicy -n kindergarten
```

Sprawdzenie PodDisruptionBudget:

```bash
kubectl get pdb -n kindergarten
```

Szczegóły poda backend (probes, limity, securityContext, initContainer):

```bash
kubectl describe pod -l app=backend -n kindergarten
```

Logi backendu:

```bash
kubectl logs -l app=backend -n kindergarten
```

---

## Przykładowe wyniki

kubectl get all:

```
NAME                            READY   STATUS    RESTARTS   AGE
pod/backend-5c967597df-5bq82    1/1     Running   0          31m
pod/backend-5c967597df-5jv7r    1/1     Running   0          31m
pod/frontend-5dc695b59f-5kgcd   1/1     Running   0          31m
pod/mongodb-0                   1/1     Running   0          45m
pod/mqtt-6994995cd6-p2dhb       1/1     Running   0          45m

NAME               TYPE        CLUSTER-IP      PORT(S)      AGE
service/backend    ClusterIP   10.96.142.88    3000/TCP     45m
service/frontend   ClusterIP   10.96.58.204    80/TCP       45m
service/mongodb    ClusterIP   None            27017/TCP    45m
service/mqtt       ClusterIP   10.96.77.33     1883/TCP     45m

NAME                       READY   UP-TO-DATE   AVAILABLE
deployment.apps/backend    2/2     2            2
deployment.apps/frontend   1/1     1            1
deployment.apps/mqtt       1/1     1            1

NAME                     READY
statefulset.apps/mongodb 1/1
```

kubectl get pvc:

```
NAME                          STATUS   CAPACITY   ACCESS MODES   AGE
mongo-storage-mongodb-0       Bound    1Gi        RWO            45m
```

kubectl get ingress:

```
NAME          CLASS   HOSTS   ADDRESS     PORTS   AGE
app-ingress   nginx   *       127.0.0.1   80      45m
```

kubectl rollout status deployment/backend:

```
deployment "backend" successfully rolled out
```

---

## Weryfikacja funkcjonalności

Test endpointu /health:

```bash
kubectl port-forward svc/backend 3000:3000 -n kindergarten &
curl http://localhost:3000/health
```

Oczekiwana odpowiedź:

```json
{ "status": "ok" }
```

Test CRUD przez Ingress:

```bash
# Rejestracja użytkownika admin
curl -X POST http://127.0.0.1/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","role":"admin"}'

# Logowanie
curl -X POST http://127.0.0.1/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## Trwałość danych – weryfikacja

```bash
# Usuń pod bazy danych
kubectl delete pod mongodb-0 -n kindergarten

# StatefulSet automatycznie odtworzy pod
kubectl get pods -n kindergarten --watch

# Po odtworzeniu dane nadal są dostępne
kubectl exec -it mongodb-0 -n kindergarten -- mongosh
# use kindergarten
# db.users.find()
```

---

## Weryfikacja MQTT

```bash
kubectl exec deployment/mqtt -n kindergarten -- mosquitto_pub -t kindergarten/gate -m "test"
kubectl exec deployment/mqtt -n kindergarten -- mosquitto_sub -t kindergarten/gate -C 1
```

Oczekiwana odpowiedź: kindergarten/gate test

Backend subskrybuje temat kindergarten/gate i aktualizuje obecność dziecka przy każdej wiadomości RFID (backend/index.js, linia 63-75).

---

## Usuwanie

```bash
kubectl delete -f k8s/
kubectl delete namespace kindergarten
minikube stop
```

---

## Link do ostatniego udanego workflow GitHub Actions

https://github.com/zvDasha/kindergarten-k8s/actions/runs/26873061818

---

---

# Weryfikacja wymagań projektowych

Poniżej lista wszystkich wymagań z zaznaczeniem gdzie dokładnie są spełnione.

---

## Wymagania architektoniczne – Kubernetes i CI/CD (80%)

### Manifesty Kubernetes (12%)

Katalog k8s/ zawiera następujące zasoby:

- Namespace: k8s/namespace.yaml
- Deployment backend: k8s/backend.yaml, linia 1
- Deployment frontend: k8s/frontend.yaml, linia 1
- Deployment mqtt: k8s/mgtt.yaml, linia 1
- StatefulSet mongodb: k8s/mongo.yaml, linia 5
- Service backend: k8s/backend.yaml, linia 87
- Service frontend: k8s/frontend.yaml, linia 50
- Service mongodb (headless): k8s/mongo.yaml, linia 56
- Service mqtt: k8s/mgtt.yaml, linia 43
- Ingress: k8s/ingress.yaml
- ConfigMap: k8s/configmap.yaml
- Secret: k8s/secret.yaml
- PVC przez volumeClaimTemplates: k8s/mongo.yaml, linia 48

---

### Deploymenty i rolling update (10%)

Backend ma 2 repliki i strategię RollingUpdate.

Plik: k8s/backend.yaml

```yaml
replicas: 2 # linia 6
strategy: # linia 7
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1
    maxSurge: 1
```

Weryfikacja:

```bash
kubectl get deploy -n kindergarten
kubectl rollout status deployment/backend -n kindergarten
```

---

### Baza danych i trwałość w Kubernetes (12%)

MongoDB działa jako StatefulSet z automatycznie tworzonymi PVC przez volumeClaimTemplates.

Plik: k8s/mongo.yaml

```yaml
kind: StatefulSet # linia 5
...
volumeClaimTemplates: # linia 48
  - metadata:
      name: mongo-storage
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 1Gi
```

StatefulSet gwarantuje stabilną tożsamość poda (mongodb-0) i podłączenie do tego samego dysku po restarcie. Dane nie są tracone po usunięciu poda.

---

### Services, Ingress i izolacja (10%)

Komunikacja wewnętrzna przez Service (ClusterIP). Ruch zewnętrzny tylko przez Ingress.

Plik: k8s/ingress.yaml

```yaml
paths:
  - path: /socket.io # → backend:3000
  - path: /api # → backend:3000
  - path: / # → frontend:80
```

Baza danych, MQTT nie są wystawione na zewnątrz:

- mongodb: clusterIP: None (headless, bez zewnętrznego IP) – k8s/mongo.yaml, linia 60
- mqtt: brak NodePort, brak LoadBalancer – k8s/mgtt.yaml, linia 43

---

### ConfigMap i Secret (8%)

Konfiguracja niepoufna w ConfigMap, dane poufne w Secret.

Plik: k8s/configmap.yaml zawiera MONGO_URI, FRONTEND_URL, MQTT_URL.

Plik: k8s/secret.yaml zawiera JWT_SECRET.

W kodzie backend nie ma żadnych hardkodowanych wartości produkcyjnych:

- backend/index.js, linia 25: `const JWT_SECRET = process.env.JWT_SECRET;`
- backend/index.js, linia 63: `mqtt.connect(process.env.MQTT_URL || "mqtt://mqtt:1883")`

Zmienne są wstrzykiwane przez Kubernetes z ConfigMap i Secret (k8s/backend.yaml, linia 39-57).

---

### Probes i zasoby (10%)

Wszystkie główne kontenery mają readinessProbe, livenessProbe oraz resources.requests i resources.limits.

Plik: k8s/backend.yaml

```yaml
resources: # linia 62
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
readinessProbe: # linia 73
  httpGet:
    path: /health
    port: 3000
livenessProbe: # linia 79
  httpGet:
    path: /health
    port: 3000
```

To samo dla frontend (k8s/frontend.yaml, linia 22-44) i mqtt (k8s/mgtt.yaml, linia 21-40).

Weryfikacja:

```bash
kubectl describe pod -l app=backend -n kindergarten
```

---

### SecurityContext oraz initContainer (8%)

Backend działa jako non-root użytkownik.

Plik: k8s/backend.yaml

```yaml
securityContext: # linia 69
  allowPrivilegeEscalation: false
  runAsNonRoot: true
  runAsUser: 1000
```

initContainer czeka na MongoDB przed startem backendu.

Plik: k8s/backend.yaml

```yaml
initContainers: # linia 22
  - name: wait-for-mongo
    image: busybox:1.36
    command:
      - sh
      - -c
      - until nc -z mongodb 27017; do sleep 3; done
```

Pozostałe kontenery (frontend, mqtt, mongodb) mają allowPrivilegeEscalation: false.

---

### CI/CD GitHub Actions (10%)

Plik: .github/workflows/main.yml

Workflow wykonuje kolejno:

1. Logowanie do ghcr.io przez docker/login-action
2. Build i push obrazów backend i frontend do ghcr.io
3. Uruchomienie minikube
4. Instalację ingress addon i usunięcie webhook
5. Zastąpienie placeholdera YOUR_GITHUB_USERNAME przez sed
6. kubectl apply -f k8s/namespace.yaml
7. kubectl apply -f k8s/
8. kubectl rollout status deployment/backend i frontend
9. kubectl get pods,svc,ingress,pvc

---

## Wymagania dodatkowe (10%)

### NetworkPolicy (2.5%)

Plik: k8s/networkpolicy.yaml

MongoDB przyjmuje ruch tylko z backendu. MQTT przyjmuje ruch tylko z backendu.

```bash
kubectl get networkpolicy -n kindergarten
```

### PodDisruptionBudget (2.5%)

Plik: k8s/pdb.yaml

Backend ma PDB z minAvailable: 1, co gwarantuje że przy aktualizacjach zawsze działa co najmniej jedna replika.

```bash
kubectl get pdb -n kindergarten
```

---

## Wymagania specyficzne dla projektu

### Minimalna funkcjonalność aplikacji (10%)

Aplikacja zarządza przedszkolem: dzieci, grupy, ogłoszenia, harmonogram, użytkownicy.

Endpoint /health: backend/index.js, linia 23

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

CRUD dzieci:

```bash
# POST /api/children, GET /api/children, PUT /api/children/:id, DELETE /api/children/:id
# backend/index.js, linia 82-120
```

### Trwałość danych aplikacji (5%)

Dane zapisywane w MongoDB działającym jako StatefulSet z PVC. Po usunięciu poda mongodb-0 dane pozostają na wolumenie i są dostępne po odtworzeniu poda.

### Cache, kolejka albo worker (5%)

Projekt zawiera broker MQTT Mosquitto jako komponent kolejkowania wiadomości.

Deployment: k8s/mgtt.yaml

Backend subskrybuje temat kindergarten/gate i reaguje na wiadomości RFID z turniketu: backend/index.js, linia 63-78.

Symulator turniketu: backend/mqttService.js – publikuje losowe karty RFID co 10 sekund.

Dowód działania:

```bash
kubectl exec deployment/mqtt -n kindergarten -- mosquitto_pub -t kindergarten/gate -m '{"rfid":"CARD_1","timestamp":"2025-01-01T00:00:00Z"}'
kubectl logs -l app=backend -n kindergarten | grep TURNIQUET
```
