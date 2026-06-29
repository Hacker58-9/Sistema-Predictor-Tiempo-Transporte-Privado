from modelo import PredictorTransporte

predictor = PredictorTransporte()
predictor.evaluar()
longitud_inicio = -79.0282632389564		
latitud_inicio = -8.117707907415134
longitud_fin = -79.0314333707192		
latitud_fin = -8.1269499124145
distancia = predictor._haversine(latitud_inicio, longitud_inicio, latitud_fin, longitud_fin)
hora = 7
dia = 0
mes = 4
prediccion = predictor._predecir_test(longitud_inicio, latitud_inicio, longitud_fin, latitud_fin, distancia, hora, dia, mes)
print(distancia)
print(prediccion)
prediccion2 = predictor.predecir(longitud_inicio, latitud_inicio, longitud_fin, latitud_fin)
print(prediccion2)