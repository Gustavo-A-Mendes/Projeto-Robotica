# PROJETO ROBOTICA
Interface para controle de braço robótico com 3GDL, para disciplina de Introdução a Robótica, no campus da UFERSA, em Pau dos Ferros, RN.

## Descrição
O projeto trabalha integração de software e hardware, criando uma interface para controlar um braço robótico com 3 graus de liberdade, aplicando os conceitos de cinemática inversa e direta, vistos na disciplina de Introdução a Robótica.

## Braço Robótico
O braço robótico é composto por três juntas rotacionais, usando servo motores, e controlados por um microcontrolador Arduino.

## Sistema de Controle
O sistema de controle possui dois modos:
- **Modo Manual**: permite que o usuário controle o braço robótico manualmente, utilizando um conjunto de potenciômetros, conectados ao Arduino e associados cada um a uma das juntas do braço.
- **Modo Automático**: permite que o usuário defina as coordenadas do braço robótico, através de uma interface feita em HTML+Javascript, utilizando os conceitos de cinemática inversa para calcular as posições das juntas.

## Como acessar a interface?
A interface pode ser acessada através do link a seguir:
<br>
<a href="https://exquisite-pothos-2af40f.netlify.app/">Sistema Controle Braço Robótico</a>

Ou pode ser acessada de maneira local, baixando os arquivo presentes neste git e executando o arquivo "index.html" em algum navegador.

## Como funcionar?
Para iniciar o sistema, é necessário conectar o braço robótico ao Arduino, e conectar o Arduino ao computador.

Em seguida, dentro da interface, deve-se apertar o botão "🔌 Conectar com Arduino", e então escolher a porta de comunicação com o Arduino.

![Tela de interace](/img/tela-interface.png)
<br>

Com isso, uma mensagem deve aparecer abaixo dos botões, indicando se foi conectado ou não.

> Antes de tentar conectar, verifique se a comunicação Serial do Arduino não está ocupada (Feche o monitor serial, plotter serial ou qualquer outra ferramenta que possa ocupar a comunicação serial).

Com a conexão bem sucedida, o sistema já estará funcionando. Para controlar a garra via interface, desmarque a opção "Modo Manual".

## Código Arduino
O código Arduino utilizado pode ser encontrado na pasta "garra", presente neste git.