import lightgbm as lgb
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
from datetime import datetime

class PredictorTransporte:
    # Variable de clase interna en inglés (estándar de la industria)
    _instance = None

    def __new__(cls, *args, **kwargs):
        """Pattern Singleton implementation"""
        if cls._instance is None:
            cls._instance = super(PredictorTransporte, cls).__new__(cls)
            cls._instance._init_model()
        return cls._instance

    def _init_model(self):
        """Loads the LightGBM model once into memory"""
        self.modelo = lgb.Booster(model_file='modelo_lightgbm.txt')

    def _evaluar_modelo(self, nombre_modelo, y_real, y_prediccion):
        mae = mean_absolute_error(y_real, y_prediccion)
        rmse = np.sqrt(mean_squared_error(y_real, y_prediccion))
        r2 = r2_score(y_real, y_prediccion)

        print(f"=== ESTADÍSTICAS DE {nombre_modelo.upper()} ===")
        print(f"MAE  (Error promedio): {mae:.2f} minutos")
        print(f"RMSE (Castigo errores): {rmse:.2f} minutos")
        print(f"R²   (Ajuste del modelo): {r2 * 100:.2f}%\n")

        return [mae, rmse, r2]

    def _haversine(self, lat1, lon1, lat2, lon2):
        r = 6371
        lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        return 2 * r * np.arcsin(np.sqrt(a))

    def _predecir_test(self, longitud_inicio, latitud_inicio, longitud_fin, latitud_fin, distancia, hora_actual, dia_semana_num, mes_actual):
                         
        datos_entrada = pd.DataFrame([{
            'pickup_longitude': longitud_inicio,
            'pickup_latitude': latitud_inicio,
            'dropoff_longitude': longitud_fin,
            'dropoff_latitude': latitud_fin,
            'distancia': distancia,
            'hora_del_dia': hora_actual,
            'dia_de_la_semana': dia_semana_num,
            'mes': mes_actual
        }])

        print(datos_entrada.head())
        prediccion = self.modelo.predict(datos_entrada)
        return prediccion
    
    def predecir(self, longitud_inicio, latitud_inicio, longitud_fin, latitud_fin):
        
        distancia = self._haversine(latitud_inicio, longitud_inicio, latitud_fin, longitud_fin)
        ahora = datetime.now()
        
        hora_actual = ahora.hour    
        dia_semana_num = ahora.weekday()     
        mes_actual  = ahora.month                    

        prediccion = self._predecir_test(longitud_inicio, latitud_inicio, longitud_fin, latitud_fin, distancia, hora_actual, dia_semana_num, mes_actual)
        return prediccion
    
    def evaluar(self):
                
        X_test : pd.DataFrame = pd.read_csv("Test Data/X_test.csv")
        y_test : pd.DataFrame = pd.read_csv("Test Data/y_test.csv")        

        # 1. Ejecutar la predicción usando nuestro propio método de clase
        y_pred = self.modelo.predict(X_test)
        
        stats_lgbm = self._evaluar_modelo("LightGBM (API nativa)", y_test, y_pred)


if __name__ == "__main__":
    predictor = PredictorTransporte()
    predictor.evaluar()
    longitud_inicio = -73.982132		
    latitud_inicio = 40.765564
    longitud_fin = -73.979362		
    latitud_fin = 40.786846
    distancia = predictor._haversine(latitud_inicio, longitud_inicio, latitud_fin, longitud_fin)
    hora = 19
    dia = 2
    mes = 4
    prediccion = predictor._predecir_test(longitud_inicio, latitud_inicio, longitud_fin, latitud_fin, distancia, hora, dia, mes)
    print(distancia)
    print(prediccion)
    prediccion2 = predictor.predecir(longitud_inicio, latitud_inicio, longitud_fin, latitud_fin)
    print(prediccion2)