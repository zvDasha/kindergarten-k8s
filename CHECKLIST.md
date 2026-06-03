# CHECKLIST.md

## Jak uruchomić projekt lokalnie (minikube)

Do uruchomienia potrzebny jest Docker, minikube i kubectl.

Najpierw startujemy klaster i włączamy ingress:

```bash
minikube start
minikube addons enable ingress
```

Budujemy obrazy wewnątrz minikube. Krok z eval jest ważny, bo bez niego obrazy trafią do lokalnego Dockera zamiast do minikube:

```bash
eval $(minikube docker-env)
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/kindergarten-backend:latest ./backend
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/kindergarten-frontend:latest ./frontend
```

Zamieniamy YOUR_GITHUB_USERNAME na swoją nazwę użytkownika w backend.yaml i frontend.yaml, albo używamy sed:

```bash
sed -i "s/YOUR_GITHUB_USERNAME/TWOJA_NAZWA/g" k8s/backend.yaml k8s/frontend.yaml
```

Aplikujemy namespace jako pierwszy, potem resztę:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

Ustawiamy namespace jako domyślny żeby nie pisać -n kindergarten przy każdej komendzie:

```bash
kubectl config set-context --current --namespace=kindergarten
```

Sprawdzamy czy pody są gotowe:

```bash
kubectl get pods --watch
```

Oczekiwany wynik po około 60 sekundach:

```
NAME                         READY   STATUS    RESTARTS   AGE
backend-7d9f8b6c5-abc12      1/1     Running   0          2m
backend-7d9f8b6c5-def34      1/1     Running   0          2m
frontend-5c8d7f9b4-ghi56     1/1     Running   0          2m
mongodb-0                    1/1     Running   0          2m
mqtt-6b7c8d9e0-jkl78         1/1     Running   0          2m
```

Żeby otworzyć aplikację:

```bash
minikube service frontend --url
```

Albo przez ingress, w osobnym terminalu:

```bash
minikube tunnel
```

Potem otwieramy http://127.0.0.1/

---

## Zasoby Kubernetes użyte w projekcie

- Namespace kindergarten
- Deployment backend (2 repliki, rolling update, initContainer)
- Deployment frontend (nginx)
- Deployment mqtt (Mosquitto broker)
- StatefulSet mongodb (MongoDB 6.0)
- Service backend (ClusterIP, port 3000)
- Service frontend (NodePort, port 30000)
- Service mongodb (headless ClusterIP, port 27017)
- Service mqtt (ClusterIP, port 1883)
- PersistentVolumeClaim mongo-storage (1Gi, tworzony przez StatefulSet)
- Ingress app-ingress (nginx)
- ConfigMap app-config (MONGO_URI, FRONTEND_URL, MQTT_URL)
- Secret app-secret (JWT_SECRET)

---

## Komendy kubectl do weryfikacji

Sprawdzenie wszystkich zasobów:

```bash
kubectl get all
```

Sprawdzenie PVC:

```bash
kubectl get pvc
```

Sprawdzenie ConfigMap i Secret:

```bash
kubectl get configmap
kubectl get secret
```

Sprawdzenie ingressa:

```bash
kubectl get ingress
```

Sprawdzenie rolling update i replik backendu:

```bash
kubectl get deploy backend
kubectl rollout status deployment/backend
```

Sprawdzenie czy initContainer zadziałał:

```bash
kubectl describe pod -l app=backend | grep -A 5 "Init Containers"
```

Sprawdzenie limitów zasobów i probes:

```bash
kubectl describe pod -l app=backend
```

Logi backendu:

```bash
kubectl logs -l app=backend
```

Weryfikacja działania MQTT (broker przyjmuje połączenia):

```bash
kubectl exec deployment/mqtt -- mosquitto_pub -t test -m "hello"
kubectl exec deployment/mqtt -- mosquitto_sub -t test -C 1
```

Test endpointu /health:

```bash
kubectl port-forward svc/backend 3000:3000 &
curl http://localhost:3000/health
```

Oczekiwany wynik: {"status":"ok"}

---

## Przykładowe wyniki komend

kubectl get all:

```
NAME                            READY   STATUS    RESTARTS   AGE
pod/backend-7d9f8b6c5-abc12    1/1     Running   0          5m
pod/backend-7d9f8b6c5-def34    1/1     Running   0          5m
pod/frontend-5c8d7f9b4-ghi56   1/1     Running   0          5m
pod/mongodb-0                  1/1     Running   0          5m
pod/mqtt-6b7c8d9e0-jkl78       1/1     Running   0          5m

NAME               TYPE        CLUSTER-IP      PORT(S)          AGE
service/backend    ClusterIP   10.96.142.88    3000/TCP         5m
service/frontend   NodePort    10.96.58.204    80:30000/TCP     5m
service/mongodb    ClusterIP   None            27017/TCP        5m
service/mqtt       ClusterIP   10.96.77.33     1883/TCP         5m

NAME                       READY   UP-TO-DATE   AVAILABLE
deployment.apps/backend    2/2     2            2
deployment.apps/frontend   1/1     1            1
deployment.apps/mqtt       1/1     1            1

NAME                     READY   AGE
statefulset.apps/mongodb 1/1     5m
```

kubectl get pvc:

```
NAME                          STATUS   CAPACITY   ACCESS MODES
mongo-storage-mongodb-0       Bound    1Gi        RWO
```

kubectl get ingress:

```
NAME          CLASS   HOSTS   ADDRESS        PORTS   AGE
app-ingress   nginx   *       192.168.49.2   80      5m
```

kubectl rollout status deployment/backend:

```
Waiting for deployment "backend" rollout to finish: 0 of 2 updated replicas are available...
Waiting for deployment "backend" rollout to finish: 1 of 2 updated replicas are available...
deployment "backend" successfully rolled out
```

---

## Trwałość danych – weryfikacja

Dodajemy rekord, usuwamy pod bazy i sprawdzamy czy dane zostały:

```bash
# Dodajemy dane przez aplikację (przez UI albo curl)
# Usuwamy pod bazy
kubectl delete pod mongodb-0
# Pod zostanie odtworzony automatycznie przez StatefulSet
kubectl get pods --watch
# Po odtworzeniu sprawdzamy czy dane nadal są dostępne w aplikacji
```

---

## Usuwanie

```bash
kubectl delete -f k8s/
kubectl delete namespace kindergarten
minikube stop
```

---
