@echo off
echo Installing all dependencies for System 4...

echo [1/3] Installing root dependencies...
call npm install

echo [2/3] Installing greenovate-be dependencies...
cd greenovate-be
call npm install
cd ..

echo [3/3] Installing nexoos dependencies...
cd nexoos
call npm install
cd ..

echo.
echo Setup complete! Run "npm run dev" to start everything.
