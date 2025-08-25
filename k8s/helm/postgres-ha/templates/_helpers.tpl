{{/*
Expand the name of the chart.
*/}}
{{- define "postgres-ha.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "postgres-ha.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "postgres-ha.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "postgres-ha.labels" -}}
helm.sh/chart: {{ include "postgres-ha.chart" . }}
{{ include "postgres-ha.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.commonLabels }}
{{ toYaml .Values.global.commonLabels }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "postgres-ha.selectorLabels" -}}
app.kubernetes.io/name: {{ include "postgres-ha.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
CloudNativePG Operator labels
*/}}
{{- define "postgres-ha.operator.labels" -}}
helm.sh/chart: {{ include "postgres-ha.chart" . }}
app.kubernetes.io/name: cloudnative-pg
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: operator
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.commonLabels }}
{{ toYaml .Values.global.commonLabels }}
{{- end }}
{{- end }}

{{/*
PostgreSQL Cluster labels
*/}}
{{- define "postgres-ha.cluster.labels" -}}
helm.sh/chart: {{ include "postgres-ha.chart" . }}
app.kubernetes.io/name: {{ .Values.cluster.name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.commonLabels }}
{{ toYaml .Values.global.commonLabels }}
{{- end }}
{{- end }}

{{/*
PgBouncer labels
*/}}
{{- define "postgres-ha.pgbouncer.labels" -}}
helm.sh/chart: {{ include "postgres-ha.chart" . }}
app.kubernetes.io/name: pgbouncer
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: connection-pooler
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.commonLabels }}
{{ toYaml .Values.global.commonLabels }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "postgres-ha.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "postgres-ha.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the S3 destination path for backups
*/}}
{{- define "postgres-ha.s3.destinationPath" -}}
{{- printf "s3://%s/%s" .Values.backup.s3.bucket .Values.backup.s3.path }}
{{- end }}

{{/*
Environment-specific values merge
*/}}
{{- define "postgres-ha.environmentValues" -}}
{{- $environment := .Values.environment | default "production" }}
{{- if hasKey .Values.environments $environment }}
{{- $envValues := index .Values.environments $environment }}
{{- $merged := mergeOverwrite .Values $envValues }}
{{- toYaml $merged }}
{{- else }}
{{- toYaml .Values }}
{{- end }}
{{- end }}

{{/*
Generate PostgreSQL connection string for PgBouncer
*/}}
{{- define "postgres-ha.connectionString" -}}
{{- printf "host=%s-rw.%s.svc.cluster.local port=5432" .Values.cluster.name .Values.global.namespace }}
{{- end }}

{{/*
Generate read-only PostgreSQL connection string for PgBouncer
*/}}
{{- define "postgres-ha.readOnlyConnectionString" -}}
{{- printf "host=%s-ro.%s.svc.cluster.local port=5432" .Values.cluster.name .Values.global.namespace }}
{{- end }}

{{/*
Common annotations
*/}}
{{- define "postgres-ha.annotations" -}}
{{- if .Values.security.linkerd.enabled }}
linkerd.io/inject: {{ .Values.security.linkerd.inject | quote }}
{{- if .Values.security.linkerd.inject }}
config.linkerd.io/proxy-cpu-request: "100m"
config.linkerd.io/proxy-memory-request: "64Mi"
{{- end }}
{{- end }}
{{- end }}